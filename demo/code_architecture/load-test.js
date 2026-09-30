const http = require('http');
const { performance } = require('perf_hooks');

const target = new URL(process.env.DEMO_API_URL || 'http://localhost:3002');
const pulseWatch = new URL(process.env.PULSEWATCH_URL || 'http://localhost:5000');
const apiKey = process.env.PULSEWATCH_API_KEY || process.env.MONITORING_API_KEY;
const requestsPerSecond = Math.min(1000, Math.max(1, Number(process.env.LOAD_RPS || 1000)));
const durationSeconds = Math.min(60, Math.max(1, Number(process.env.LOAD_DURATION_SECONDS || 10)));
const totalRequests = requestsPerSecond * durationSeconds;
const requestTimeoutMs = Math.max(5000, Number(process.env.LOAD_REQUEST_TIMEOUT_MS || 15000));
const drainMs = Math.max(1000, Number(process.env.LOAD_DRAIN_MS || 5000));
const maxSockets = Math.min(1000, Math.max(32, Number(process.env.LOAD_MAX_SOCKETS || 256)));
const agent = new http.Agent({ keepAlive: true, maxSockets });
const counts = { sent: 0, completed: 0, succeeded: 0, failed: 0, status: {}, errors: {} };
const startedAt = performance.now();
let nextReportAt = 1;
let reporter;

function sendRequest(requestNumber) {
    const endpointNumber = requestNumber % 10 + 1;
    const path = `/api/demo/endpoint-${endpointNumber}`;
    const request = http.get({
        hostname: target.hostname,
        port: target.port || 80,
        path,
        method: 'GET',
        agent,
        headers: { 'x-request-id': `demo-${requestNumber + 1}` },
        timeout: requestTimeoutMs,
    }, (response) => {
        response.resume();
        const status = response.statusCode || 0;
        counts.status[status] = (counts.status[status] || 0) + 1;
        if (status >= 200 && status < 400) counts.succeeded += 1;
        else counts.failed += 1;
        finishOne();
    });

    request.on('timeout', () => request.destroy(new Error('request timeout')));
    request.on('error', (error) => {
        counts.failed += 1;
        const errorCode = error.code || error.message;
        counts.errors[errorCode] = (counts.errors[errorCode] || 0) + 1;
        finishOne();
    });
}

function finishOne() {
    counts.completed += 1;
    if (counts.completed === totalRequests) {
        clearInterval(reporter);
        console.log(`Load sent: ${counts.sent}/${totalRequests}; completed: ${counts.completed}; success: ${counts.succeeded}; failed: ${counts.failed}; status: ${JSON.stringify(counts.status)}; errors: ${JSON.stringify(counts.errors)}`);
        console.log(`Waiting ${drainMs}ms for asynchronous PulseWatch ingest requests to drain.`);
        setTimeout(() => {
            agent.destroy();
            console.log('Load test finished.');
        }, drainMs);
    }
}

function sendDueRequests() {
    const elapsedMs = performance.now() - startedAt;
    const targetSent = Math.min(totalRequests, Math.floor(elapsedMs * requestsPerSecond / 1000));
    while (counts.sent < targetSent) {
        sendRequest(counts.sent);
        counts.sent += 1;
    }

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds >= nextReportAt && counts.sent < totalRequests) {
        console.log(`Progress ${elapsedSeconds}s: sent ${counts.sent}/${totalRequests}, completed ${counts.completed}`);
        nextReportAt = elapsedSeconds + 1;
    }
}

function verifyPulseWatchKey() {
    return new Promise((resolve, reject) => {
        if (!apiKey) {
            reject(new Error('Set PULSEWATCH_API_KEY before starting the load test.'));
            return;
        }

        const request = http.request({
            hostname: pulseWatch.hostname,
            port: pulseWatch.port || 80,
            path: '/api/hit',
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
            },
            timeout: requestTimeoutMs,
        }, (response) => {
            response.resume();
            if (response.statusCode === 202) resolve();
            else reject(new Error(`PulseWatch key preflight failed with HTTP ${response.statusCode}; no load traffic was sent.`));
        });

        request.on('timeout', () => request.destroy(new Error('PulseWatch key preflight timed out.')));
        request.on('error', reject);
        request.end(JSON.stringify({
            serviceName: 'demo-api-preflight',
            endpoint: '/load-test/preflight',
            method: 'GET',
            statusCode: 200,
            latencyMs: 1,
        }));
    });
}

verifyPulseWatchKey().then(() => {
    console.log(`PulseWatch key accepted. Sending ${requestsPerSecond} requests/second for ${durationSeconds}s to ${target.origin} across 10 endpoints with ${maxSockets} keep-alive sockets.`);
    reporter = setInterval(sendDueRequests, 5);
}).catch((error) => {
    agent.destroy();
    console.error(error.message);
    process.exitCode = 1;
});
