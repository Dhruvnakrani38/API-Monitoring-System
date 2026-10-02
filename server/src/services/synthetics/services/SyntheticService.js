const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);

function getValueByPath(obj, path) {
    if (!obj || typeof obj !== 'object' || !path) return undefined;
    const cleanPath = path.replace(/^\$\./, '').replace(/^\$/, '');
    if (!cleanPath) return obj;
    const parts = cleanPath.split('.').flatMap(p => p.split(/\[(\d+)\]/).filter(Boolean));
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
}

export class SyntheticService {
    constructor({ repository }) { this.repository = repository; }

    validate(input) {
        const url = new URL(input.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Check URL must use HTTP or HTTPS');
        const method = String(input.method || 'GET').toUpperCase();
        if (!METHODS.has(method)) throw new Error('Unsupported check method');
        const timeoutMs = Number(input.timeoutMs || 10000);
        const intervalSeconds = Number(input.intervalSeconds || 60);
        const expectedStatus = Number(input.expectedStatus || 200);
        const maxLatencyMs = input.maxLatencyMs ? Number(input.maxLatencyMs) : null;
        const failureThreshold = Number(input.failureThreshold || 3);

        if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 120000) throw new Error('Timeout must be between 500 and 120000 ms');
        if (!Number.isInteger(intervalSeconds) || intervalSeconds < 10 || intervalSeconds > 86400) throw new Error('Interval must be between 10 seconds and 24 hours');
        if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) throw new Error('Expected status must be a valid HTTP status');
        if (maxLatencyMs !== null && (!Number.isInteger(maxLatencyMs) || maxLatencyMs < 1)) throw new Error('Max latency must be a positive integer in ms');
        if (!Number.isInteger(failureThreshold) || failureThreshold < 1 || failureThreshold > 10) throw new Error('Failure threshold must be between 1 and 10');

        let headers = {};
        if (typeof input.headers === 'string') {
            try { headers = JSON.parse(input.headers); } catch (e) { throw new Error('Headers must be valid JSON object'); }
        } else if (typeof input.headers === 'object' && input.headers !== null) {
            headers = input.headers;
        }

        let assertions = [];
        if (typeof input.assertions === 'string') {
            try { assertions = JSON.parse(input.assertions); } catch (e) { throw new Error('Assertions must be valid JSON array'); }
        } else if (Array.isArray(input.assertions)) {
            assertions = input.assertions;
        }

        return {
            name: String(input.name || '').trim(),
            url: url.toString(),
            method,
            timeoutMs,
            intervalSeconds,
            expectedStatus,
            headers,
            body: typeof input.body === 'string' ? input.body : '',
            assertions,
            maxLatencyMs,
            failureThreshold,
        };
    }

    list(clientId) { return this.repository.list(clientId); }
    runs(id, clientId) { return this.repository.runs(id, clientId); }
    create(clientId, input, createdBy) { const check = this.validate(input); if (!check.name) throw new Error('Check name is required'); return this.repository.create({ ...check, clientId, createdBy }); }
    remove(id, clientId) { return this.repository.remove(id, clientId); }

    evaluateAssertions(check, statusCode, latencyMs, headers, bodyText) {
        const results = [];
        let parsedJson = null;
        try { parsedJson = JSON.parse(bodyText); } catch (e) { /* non-JSON response */ }

        // Default assertion 1: Expected status code
        const statusPassed = statusCode === check.expected_status;
        results.push({
            type: 'status_code',
            passed: statusPassed,
            message: statusPassed
                ? `Status code is ${statusCode}`
                : `Expected status ${check.expected_status}, received ${statusCode}`,
        });

        // Default assertion 2: Max latency check (if defined)
        const maxLatency = check.max_latency_ms || check.maxLatencyMs;
        if (maxLatency) {
            const latencyPassed = latencyMs <= maxLatency;
            results.push({
                type: 'max_latency',
                passed: latencyPassed,
                message: latencyPassed
                    ? `Latency ${latencyMs}ms <= ${maxLatency}ms`
                    : `Latency ${latencyMs}ms exceeded limit of ${maxLatency}ms`,
            });
        }

        // Custom assertions execution
        const customAssertions = Array.isArray(check.assertions) ? check.assertions : [];
        for (const ast of customAssertions) {
            if (!ast || !ast.type) continue;

            if (ast.type === 'status_code') {
                const targetStatus = Number(ast.value || 200);
                const passed = statusCode === targetStatus;
                results.push({
                    type: ast.type,
                    passed,
                    message: passed ? `Status code equals ${targetStatus}` : `Expected status code ${targetStatus}, got ${statusCode}`,
                });
            } else if (ast.type === 'max_latency') {
                const limitMs = Number(ast.value);
                const passed = latencyMs <= limitMs;
                results.push({
                    type: ast.type,
                    passed,
                    message: passed ? `Latency ${latencyMs}ms <= ${limitMs}ms` : `Latency ${latencyMs}ms exceeded threshold ${limitMs}ms`,
                });
            } else if (ast.type === 'header_contains') {
                const headerKey = String(ast.key || '').toLowerCase();
                const expectedSub = String(ast.value || '').toLowerCase();
                const actualVal = String(headers.get ? (headers.get(headerKey) || '') : (headers[headerKey] || '')).toLowerCase();
                const passed = actualVal.includes(expectedSub);
                results.push({
                    type: ast.type,
                    passed,
                    message: passed
                        ? `Header '${headerKey}' contains '${ast.value}'`
                        : `Header '${headerKey}' ('${actualVal}') does not contain '${ast.value}'`,
                });
            } else if (ast.type === 'body_contains') {
                const target = String(ast.value || '');
                const passed = bodyText.includes(target);
                results.push({
                    type: ast.type,
                    passed,
                    message: passed ? `Body contains '${target}'` : `Body does not contain '${target}'`,
                });
            } else if (ast.type === 'body_not_contains') {
                const target = String(ast.value || '');
                const passed = !bodyText.includes(target);
                results.push({
                    type: ast.type,
                    passed,
                    message: passed ? `Body does not contain '${target}'` : `Body unexpectedly contains '${target}'`,
                });
            } else if (ast.type === 'json_path') {
                const path = String(ast.path || '');
                const expectedVal = ast.expected;
                const op = ast.operator || 'equals';
                const val = getValueByPath(parsedJson, path);

                let passed = false;
                let msg = '';
                if (op === 'exists') {
                    passed = val !== undefined && val !== null;
                    msg = passed ? `JSONPath '${path}' exists` : `JSONPath '${path}' does not exist`;
                } else if (op === 'not_exists') {
                    passed = val === undefined || val === null;
                    msg = passed ? `JSONPath '${path}' does not exist` : `JSONPath '${path}' exists (${JSON.stringify(val)})`;
                } else {
                    passed = String(val) === String(expectedVal);
                    msg = passed
                        ? `JSONPath '${path}' == '${expectedVal}'`
                        : `JSONPath '${path}' expected '${expectedVal}', got '${val}'`;
                }
                results.push({ type: ast.type, passed, message: msg });
            }
        }

        const passedAssertions = results.filter((r) => r.passed).length;
        const totalAssertions = results.length;
        const allPassed = passedAssertions === totalAssertions;

        return { allPassed, passedAssertions, totalAssertions, assertionResults: results };
    }

    async run(check) {
        const startedAt = Date.now();
        let result;
        try {
            const fetchHeaders = typeof check.headers === 'string' ? JSON.parse(check.headers || '{}') : (check.headers || {});
            const options = {
                method: check.method,
                headers: fetchHeaders,
                signal: AbortSignal.timeout(check.timeout_ms),
            };

            if (['POST', 'PUT', 'PATCH'].includes(check.method) && check.body) {
                options.body = typeof check.body === 'object' ? JSON.stringify(check.body) : String(check.body);
            }

            const response = await fetch(check.url, options);
            const latencyMs = Date.now() - startedAt;
            const bodyText = await response.text();

            const evaluation = this.evaluateAssertions(check, response.status, latencyMs, response.headers, bodyText);

            result = {
                success: evaluation.allPassed,
                statusCode: response.status,
                latencyMs,
                errorMessage: evaluation.allPassed ? null : evaluation.assertionResults.find(r => !r.passed)?.message || 'Assertions failed',
                assertionResults: evaluation.assertionResults,
                passedAssertions: evaluation.passedAssertions,
                totalAssertions: evaluation.totalAssertions,
            };
        } catch (error) {
            const latencyMs = Date.now() - startedAt;
            const errMsg = error.name === 'TimeoutError' ? 'Request timed out' : error.message;
            result = {
                success: false,
                statusCode: null,
                latencyMs,
                errorMessage: errMsg,
                assertionResults: [{ type: 'network_error', passed: false, message: errMsg }],
                passedAssertions: 0,
                totalAssertions: 1,
            };
        }
        await this.repository.recordRun(check.id, result, check);
        return result;
    }

    async runDue() {
        try {
            const checks = await this.repository.due();
            for (const check of checks) {
                try {
                    await this.run(check);
                } catch (err) {
                    // Suppress individual check execution errors
                }
            }
        } catch (err) {
            // Suppress repository due query errors
        }
    }
}