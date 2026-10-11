/**
 * JourneyService — Executes multi-step API user journeys.
 *
 * Key Capabilities:
 *   1. Sequential step execution (each step uses results from the previous).
 *   2. Variable Extraction: JSON path values extracted from response body and
 *      injected into subsequent steps' URL, headers, and body templates.
 *   3. Assertion evaluation (status code, max latency, body_contains, json_path).
 *   4. Deterministic failure tracking via JourneyRepository.
 */

function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    const clean = path.replace(/^\$\.?/, '');
    if (!clean) return obj;
    return clean.split('.').reduce((acc, key) => {
        if (acc === undefined || acc === null) return undefined;
        // Handle array notation like items[0]
        const arrMatch = key.match(/^(.+)\[(\d+)\]$/);
        if (arrMatch) return acc[arrMatch[1]]?.[Number(arrMatch[2])];
        return acc[key];
    }, obj);
}

/**
 * Replace `{{varName}}` placeholders in a string with extracted variable values.
 */
function interpolate(template, vars) {
    if (!template || typeof template !== 'string' || Object.keys(vars).length === 0) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`);
}

function interpolateHeaders(headers, vars) {
    if (!headers || typeof headers !== 'object') return headers;
    const result = {};
    for (const [k, v] of Object.entries(headers)) {
        result[k] = interpolate(String(v), vars);
    }
    return result;
}

function evaluateAssertions(assertions = [], statusCode, latencyMs, bodyText, parsedJson) {
    const results = [];
    for (const ast of assertions) {
        if (!ast?.type) continue;
        if (ast.type === 'status_code') {
            const target = Number(ast.value || 200);
            const passed = statusCode === target;
            results.push({ type: ast.type, passed, message: passed ? `Status ${statusCode} ✓` : `Expected ${target}, got ${statusCode}` });
        } else if (ast.type === 'max_latency') {
            const limit = Number(ast.value);
            const passed = latencyMs <= limit;
            results.push({ type: ast.type, passed, message: passed ? `Latency ${latencyMs}ms ≤ ${limit}ms ✓` : `Latency ${latencyMs}ms exceeded ${limit}ms` });
        } else if (ast.type === 'body_contains') {
            const passed = bodyText.includes(String(ast.value || ''));
            results.push({ type: ast.type, passed, message: passed ? `Body contains "${ast.value}" ✓` : `Body missing "${ast.value}"` });
        } else if (ast.type === 'json_path') {
            const val = getByPath(parsedJson, String(ast.path || ''));
            const op = ast.operator || 'equals';
            let passed = false;
            let message = '';
            if (op === 'exists') {
                passed = val !== undefined && val !== null;
                message = passed ? `$.${ast.path} exists ✓` : `$.${ast.path} does not exist`;
            } else {
                passed = String(val) === String(ast.expected);
                message = passed ? `$.${ast.path} == "${ast.expected}" ✓` : `$.${ast.path} expected "${ast.expected}", got "${val}"`;
            }
            results.push({ type: ast.type, passed, message });
        }
    }
    return results;
}

export class JourneyService {
    constructor({ repository }) {
        this.repository = repository;
    }

    list(clientId) { return this.repository.list(clientId); }
    getById(id, clientId) { return this.repository.findById(id, clientId); }
    runs(id, clientId) { return this.repository.runs(id, clientId); }

    validateStep(s, index) {
        if (!s.name) throw new Error(`Step ${index + 1}: name is required`);
        new URL(s.url); // Throws if invalid URL
        const method = String(s.method || 'GET').toUpperCase();
        const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
        if (!METHODS.has(method)) throw new Error(`Step ${index + 1}: unsupported method "${method}"`);
        return true;
    }

    validateJourney(input) {
        if (!input.name || !String(input.name).trim()) throw new Error('Journey name is required');
        const steps = Array.isArray(input.steps) ? input.steps : [];
        if (steps.length < 1) throw new Error('At least one step is required');
        if (steps.length > 20) throw new Error('Maximum 20 steps per journey');
        steps.forEach((s, i) => this.validateStep(s, i));
        return {
            name: String(input.name).trim(),
            description: String(input.description || '').trim(),
            intervalSeconds: Math.max(30, Math.min(86400, Number(input.intervalSeconds || 300))),
            failureThreshold: Math.max(1, Math.min(10, Number(input.failureThreshold || 2))),
            steps,
        };
    }

    async create(clientId, input, createdBy) {
        const data = this.validateJourney(input);
        return this.repository.create({ ...data, clientId, createdBy });
    }

    async remove(id, clientId) {
        return this.repository.remove(id, clientId);
    }

    /**
     * Run a single journey sequentially:
     *   1. Interpolate templates with extracted variables from previous steps.
     *   2. Execute HTTP request.
     *   3. Evaluate assertions.
     *   4. Extract variables for next steps.
     *   5. If any step fails → mark journey as failed and stop.
     */
    async runJourney(journeyId, clientId = null) {
        const journeyWithSteps = await this.repository.findById(journeyId, clientId);
        if (!journeyWithSteps) throw new Error(`Journey ${journeyId} not found`);
        return this._executeJourney(journeyWithSteps);
    }

    async _executeJourney(journey) {
        const startTime = Date.now();
        const steps = journey.steps || [];
        const stepResults = [];
        const vars = {}; // Accumulated extracted variables

        let success = true;
        let failedStepName = null;
        let errorMessage = null;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];

            // Interpolate URL, headers, body with extracted variables from previous steps
            const url = interpolate(step.url, vars);
            const rawHeaders = typeof step.headers === 'string' ? JSON.parse(step.headers || '{}') : (step.headers || {});
            const headers = interpolateHeaders(rawHeaders, vars);
            const body = interpolate(step.body || '', vars);

            const stepStart = Date.now();
            let stepResult = {
                stepOrder: step.step_order,
                name: step.name,
                url,
                method: step.method,
                success: false,
                statusCode: null,
                latencyMs: null,
                errorMessage: null,
                assertionResults: [],
                extractedVars: {},
            };

            try {
                const options = {
                    method: step.method,
                    headers,
                    signal: AbortSignal.timeout(step.timeout_ms || 10000),
                };

                if (['POST', 'PUT', 'PATCH'].includes(step.method) && body) {
                    options.body = body;
                    if (!headers['Content-Type'] && !headers['content-type']) {
                        options.headers['Content-Type'] = 'application/json';
                    }
                }

                const response = await fetch(url, options);
                const latencyMs = Date.now() - stepStart;
                const bodyText = await response.text();

                let parsedJson = null;
                try { parsedJson = JSON.parse(bodyText); } catch {}

                // Default: status code assertion
                const statusPassed = response.status === (step.expected_status || 200);
                const assertionResults = [
                    {
                        type: 'status_code',
                        passed: statusPassed,
                        message: statusPassed
                            ? `Status ${response.status} ✓`
                            : `Expected ${step.expected_status || 200}, got ${response.status}`,
                    },
                ];

                // Max latency assertion
                if (step.max_latency_ms) {
                    const latPassed = latencyMs <= step.max_latency_ms;
                    assertionResults.push({
                        type: 'max_latency',
                        passed: latPassed,
                        message: latPassed ? `Latency ${latencyMs}ms ≤ ${step.max_latency_ms}ms ✓` : `Latency ${latencyMs}ms exceeded ${step.max_latency_ms}ms`,
                    });
                }

                // Custom assertions
                const customAssertions = Array.isArray(step.assertions) ? step.assertions : [];
                assertionResults.push(...evaluateAssertions(customAssertions, response.status, latencyMs, bodyText, parsedJson));

                const stepPassed = assertionResults.every(a => a.passed);

                // Variable extraction (runs even if assertions fail — for debugging)
                const extractRules = Array.isArray(step.extract_variables) ? step.extract_variables : [];
                const extractedVars = {};
                for (const rule of extractRules) {
                    if (!rule.varName || !rule.jsonPath) continue;
                    const extracted = getByPath(parsedJson, rule.jsonPath);
                    if (extracted !== undefined) {
                        vars[rule.varName] = extracted; // Persist for next steps
                        extractedVars[rule.varName] = extracted;
                    }
                }

                stepResult = {
                    ...stepResult,
                    success: stepPassed,
                    statusCode: response.status,
                    latencyMs,
                    assertionResults,
                    extractedVars,
                };

                if (!stepPassed) {
                    success = false;
                    failedStepName = step.name;
                    errorMessage = assertionResults.find(a => !a.passed)?.message || 'Step failed';
                    stepResults.push(stepResult);
                    break; // Stop on first failure (chain is broken)
                }

            } catch (err) {
                stepResult = {
                    ...stepResult,
                    latencyMs: Date.now() - stepStart,
                    errorMessage: err.name === 'TimeoutError' ? `Step timed out after ${step.timeout_ms || 10000}ms` : err.message,
                    assertionResults: [{ type: 'network_error', passed: false, message: err.message }],
                };
                success = false;
                failedStepName = step.name;
                errorMessage = stepResult.errorMessage;
                stepResults.push(stepResult);
                break;
            }

            stepResults.push(stepResult);
        }

        const durationMs = Date.now() - startTime;
        const passedSteps = stepResults.filter(s => s.success).length;

        await this.repository.recordRun(journey.id, {
            success,
            totalSteps: steps.length,
            passedSteps,
            failedStepName,
            errorMessage,
            durationMs,
            stepResults,
        });

        return { success, totalSteps: steps.length, passedSteps, failedStepName, errorMessage, durationMs, stepResults };
    }

    async runDue() {
        try {
            const dueJourneys = await this.repository.due();
            for (const journey of dueJourneys) {
                try {
                    await this.runJourney(journey.id);
                } catch {}
            }
        } catch {}
    }
}
