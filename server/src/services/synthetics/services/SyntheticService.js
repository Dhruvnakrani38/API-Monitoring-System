const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);

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
        if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 120000) throw new Error('Timeout must be between 500 and 120000 ms');
        if (!Number.isInteger(intervalSeconds) || intervalSeconds < 10 || intervalSeconds > 86400) throw new Error('Interval must be between 10 seconds and 24 hours');
        if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) throw new Error('Expected status must be a valid HTTP status');
        return { name: String(input.name || '').trim(), url: url.toString(), method, timeoutMs, intervalSeconds, expectedStatus };
    }

    list(clientId) { return this.repository.list(clientId); }
    runs(id, clientId) { return this.repository.runs(id, clientId); }
    create(clientId, input, createdBy) { const check = this.validate(input); if (!check.name) throw new Error('Check name is required'); return this.repository.create({ ...check, clientId, createdBy }); }
    remove(id, clientId) { return this.repository.remove(id, clientId); }

    async run(check) {
        const startedAt = Date.now();
        let result;
        try {
            const response = await fetch(check.url, { method: check.method, signal: AbortSignal.timeout(check.timeout_ms) });
            result = { success: response.status === check.expected_status, statusCode: response.status, latencyMs: Date.now() - startedAt, errorMessage: response.status === check.expected_status ? null : `Expected ${check.expected_status}, received ${response.status}` };
        } catch (error) {
            result = { success: false, statusCode: null, latencyMs: Date.now() - startedAt, errorMessage: error.name === 'TimeoutError' ? 'Request timed out' : error.message };
        }
        await this.repository.recordRun(check.id, result);
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