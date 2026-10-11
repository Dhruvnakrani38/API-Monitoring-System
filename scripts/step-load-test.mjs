#!/usr/bin/env node

/**
 * ============================================================================
 * PulseWatch Stepped Load & Maximum Throughput Benchmark
 * ============================================================================
 * Evaluates platform capacity under ramped stress by increasing concurrency
 * every 10 seconds by +100 workers (100 -> 200 -> 300 -> 400 -> 500...).
 * 
 * Measures for every 10s stage:
 *   - Hits Per Second (Throughput / RPS)
 *   - Min, Avg, Max, p50, p90, p95, p99 latency percentiles
 *   - Success vs Error rate and HTTP status codes
 *   - Identifies Maximum Peak RPS achieved and system breaking point
 * 
 * Usage:
 *   node scripts/step-load-test.mjs [--url <URL>] [--endpoint /health] [--step-sec 10] [--step-inc 100] [--max-workers 500]
 * ============================================================================
 */

import http from 'http';
import https from 'https';

const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return defaultValue;
}

const IS_INGEST = args.includes('--ingest');
const DEFAULT_ENDPOINT = IS_INGEST ? '/api/hit' : '/health';
const ENDPOINT = getArg('--endpoint', DEFAULT_ENDPOINT);
const STEP_DURATION_SEC = parseInt(getArg('--step-sec', '10'), 10);
const STEP_INCREMENT = parseInt(getArg('--step-inc', '100'), 10);
const START_WORKERS = parseInt(getArg('--start-workers', '100'), 10);
const MAX_WORKERS = parseInt(getArg('--max-workers', '500'), 10);
const ADMIN_USER = getArg('--admin-user', 'admin');
const ADMIN_PASS = getArg('--admin-pass', 'Admin@PulseWatch2026!');

const SERVICES = [
    { name: 'order-service', endpoints: ['/api/v1/checkout', '/api/v1/orders'], avgLatency: 110 },
    { name: 'auth-service', endpoints: ['/api/v1/auth/login', '/api/v1/auth/verify'], avgLatency: 55 },
    { name: 'payment-gateway', endpoints: ['/api/v1/payments/charge', '/api/v1/payments/webhook'], avgLatency: 180 },
    { name: 'catalog-service', endpoints: ['/api/v1/products/search', '/api/v1/categories'], avgLatency: 35 },
    { name: 'notification-service', endpoints: ['/api/v1/notifications/email', '/api/v1/notifications/push'], avgLatency: 75 },
];

let globalApiKey = null;

async function getIngestApiKey() {
    console.log('🔑 Authenticating as SuperAdmin to acquire Telemetry API Key...');
    const url = new URL(`${BASE_URL}/api/auth/login`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const token = await new Promise((resolve, reject) => {
        const body = JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS });
        const req = client.request({
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed?.data?.token);
                } catch { reject(new Error('Login parse failed')); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });

    if (!token) throw new Error('Could not obtain SuperAdmin token');

    // Fetch existing clients
    const clientsRes = await fetch(`${BASE_URL}/api/admin/clients`, { headers: { 'Authorization': `Bearer ${token}` } });
    const clientsData = await clientsRes.json();
    const clientId = clientsData?.data?.[0]?._id;

    if (!clientId) throw new Error('No client found to acquire API key');

    const keyRes = await fetch(`${BASE_URL}/api/admin/clients/${clientId}/api/keys/reveal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ADMIN_PASS })
    });
    const keyData = await keyRes.json();
    const rawKey = keyData?.data?.[0]?.keyValue;

    if (!rawKey) throw new Error('Could not reveal API key');
    console.log(`✅ Telemetry Ingest Key verified: ${rawKey.substring(0, 10)}...`);
    return rawKey;
}

const COLORS = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

// High-capacity Keep-Alive Agents supporting up to 1000 concurrent sockets
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 1000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 1000 });

function calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

function executeSingleRequest(urlObj) {
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const start = performance.now();

    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'PulseWatch-Stepped-Load-Tester/1.0',
    };

    let bodyData = null;
    let method = 'GET';

    if (IS_INGEST) {
        method = 'POST';
        headers['Content-Type'] = 'application/json';
        headers['x-api-key'] = globalApiKey;
        const svc = SERVICES[Math.floor(Math.random() * SERVICES.length)];
        const ep = svc.endpoints[Math.floor(Math.random() * svc.endpoints.length)];
        bodyData = JSON.stringify({
            serviceName: svc.name,
            endpoint: ep,
            method: 'GET',
            statusCode: Math.random() < 0.95 ? 200 : 500,
            latencyMs: Math.round(svc.avgLatency + (Math.random() - 0.5) * 40),
        });
        headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    return new Promise((resolve) => {
        const req = client.request({
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method,
            headers,
            agent,
            timeout: 10000,
        }, (res) => {
            res.on('data', () => {}); // consume
            res.on('end', () => {
                const latency = Math.round(performance.now() - start);
                resolve({
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    statusCode: res.statusCode,
                    latency,
                    error: null,
                });
            });
        });

        req.on('error', (err) => {
            const latency = Math.round(performance.now() - start);
            resolve({
                success: false,
                statusCode: 0,
                latency,
                error: err.message,
            });
        });

        req.on('timeout', () => {
            req.destroy();
            const latency = Math.round(performance.now() - start);
            resolve({
                success: false,
                statusCode: 408,
                latency,
                error: 'Timeout',
            });
        });

        if (bodyData) req.write(bodyData);
        req.end();
    });
}

/**
 * Runs a fixed duration test with a fixed number of concurrent workers.
 * Each worker continuously sends requests until stageDeadline is reached.
 */
async function runStage({ stageNumber, concurrency, durationSec, urlObj }) {
    console.log(`\n${COLORS.bold}━━━ [Stage ${stageNumber}] Concurrency: ${concurrency} Workers | Duration: ${durationSec}s ━━━${COLORS.reset}`);

    const stageResults = [];
    let completedRequests = 0;
    const stageStartTime = performance.now();
    const stageDeadline = stageStartTime + (durationSec * 1000);

    // Live counter display
    const updateInterval = setInterval(() => {
        const elapsedSec = (performance.now() - stageStartTime) / 1000;
        const currentRps = (completedRequests / Math.max(0.1, elapsedSec)).toFixed(1);
        const remainingSec = Math.max(0, Math.ceil(durationSec - elapsedSec));
        process.stdout.write(`\r  Running: [Workers: ${concurrency}] | Hits: ${completedRequests} | Speed: ${currentRps} req/s | Remaining: ${remainingSec}s `);
    }, 250);

    // Each worker function
    async function worker() {
        while (performance.now() < stageDeadline) {
            try {
                const res = await executeSingleRequest(urlObj);
                stageResults.push(res);
                completedRequests++;
            } catch (err) {
                stageResults.push({ success: false, statusCode: 0, latency: 0, error: err.message });
                completedRequests++;
            }
        }
    }

    // Launch worker pool
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    clearInterval(updateInterval);
    process.stdout.write('\r' + ' '.repeat(90) + '\r'); // clear line

    const actualDurationSec = (performance.now() - stageStartTime) / 1000;
    const totalHits = stageResults.length;
    const rps = Math.round((totalHits / actualDurationSec) * 10) / 10;

    const latencies = stageResults.map(r => r.latency).sort((a, b) => a - b);
    const successful = stageResults.filter(r => r.success).length;
    const failed = totalHits - successful;
    const successRate = totalHits > 0 ? ((successful / totalHits) * 100).toFixed(1) : '0.0';

    const statusCounts = {};
    for (const r of stageResults) {
        statusCounts[r.statusCode] = (statusCounts[r.statusCode] || 0) + 1;
    }

    const minLat = latencies[0] || 0;
    const maxLat = latencies[latencies.length - 1] || 0;
    const avgLat = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
    const p50 = calculatePercentile(latencies, 50);
    const p90 = calculatePercentile(latencies, 90);
    const p95 = calculatePercentile(latencies, 95);
    const p99 = calculatePercentile(latencies, 99);

    console.log(`  ⏱️  Completed:   ${COLORS.bold}${totalHits}${COLORS.reset} requests in ${actualDurationSec.toFixed(2)}s`);
    console.log(`  ⚡ Throughput:  ${COLORS.bold}${COLORS.green}${rps} req/s${COLORS.reset} (Hits Per Second)`);
    console.log(`  📊 Success:     ${COLORS.green}${successful}${COLORS.reset} (${successRate}%) | Failed/429: ${failed > 0 ? COLORS.red : COLORS.dim}${failed}${COLORS.reset}`);
    console.log(`  📈 Latency:     p50: ${p50}ms | p90: ${p90}ms | p95: ${p95}ms | p99: ${p99}ms | Avg: ${avgLat}ms`);

    return {
        stageNumber,
        concurrency,
        durationSec: actualDurationSec.toFixed(1),
        totalHits,
        rps,
        minLat,
        avgLat,
        maxLat,
        p50,
        p90,
        p95,
        p99,
        successful,
        failed,
        successRate,
        statusCounts,
    };
}

async function run() {
    console.log(`\n================================================================================`);
    console.log(`🚀 PulseWatch Stepped Load Capacity Benchmark`);
    console.log(`================================================================================`);
    console.log(`  📍 Target:        ${COLORS.cyan}${BASE_URL}${ENDPOINT}${COLORS.reset}`);
    console.log(`  ⏱️  Step Duration: ${COLORS.bold}${STEP_DURATION_SEC} seconds per stage${COLORS.reset}`);
    console.log(`  📈 Step Increment:+${COLORS.bold}${STEP_INCREMENT} concurrent workers every 10s${COLORS.reset}`);
    console.log(`  🎯 Worker Stages: ${START_WORKERS} -> ${MAX_WORKERS} workers`);
    console.log(`================================================================================\n`);

    if (IS_INGEST) {
        globalApiKey = await getIngestApiKey();
    }

    const urlObj = new URL(`${BASE_URL}${ENDPOINT}`);
    const stageReports = [];
    let currentConcurrency = START_WORKERS;
    let stageIndex = 1;

    while (currentConcurrency <= MAX_WORKERS) {
        const report = await runStage({
            stageNumber: stageIndex,
            concurrency: currentConcurrency,
            durationSec: STEP_DURATION_SEC,
            urlObj,
        });

        stageReports.push(report);

        // Cooldown pause between stages to let sockets settle
        if (currentConcurrency + STEP_INCREMENT <= MAX_WORKERS) {
            process.stdout.write(`  ⏳ 2s socket stabilization cooldown...\n`);
            await new Promise(r => setTimeout(r, 2000));
        }

        currentConcurrency += STEP_INCREMENT;
        stageIndex++;
    }

    // =========================================================================
    // FINAL COMPREHENSIVE MATRIX REPORT
    // =========================================================================
    console.log(`\n\n================================================================================`);
    console.log(`📊 PULSEWATCH STEPPED LOAD PERFORMANCE MATRIX`);
    console.log(`================================================================================\n`);

    // Table Header
    const colStage = 'Stage'.padEnd(7);
    const colWorkers = 'Workers'.padStart(8);
    const colHits = 'Total Hits'.padStart(11);
    const colRps = 'Hit/Sec (RPS)'.padStart(14);
    const colAvg = 'Avg Lat'.padStart(9);
    const colP50 = 'p50'.padStart(7);
    const colP90 = 'p90'.padStart(7);
    const colP95 = 'p95'.padStart(7);
    const colP99 = 'p99'.padStart(7);
    const colSuccess = 'Success %'.padStart(10);

    console.log(`${colStage} | ${colWorkers} | ${colHits} | ${colRps} | ${colAvg} | ${colP50} | ${colP90} | ${colP95} | ${colP99} | ${colSuccess}`);
    console.log('-'.repeat(98));

    let peakRps = 0;
    let peakStage = null;
    let totalAllHits = 0;

    for (const r of stageReports) {
        totalAllHits += r.totalHits;
        if (r.rps > peakRps) {
            peakRps = r.rps;
            peakStage = r;
        }

        const sStage = `Stage ${r.stageNumber}`.padEnd(7);
        const sWorkers = `${r.concurrency}`.padStart(8);
        const sHits = `${r.totalHits}`.padStart(11);
        const sRps = `${r.rps}`.padStart(14);
        const sAvg = `${r.avgLat}ms`.padStart(9);
        const sP50 = `${r.p50}ms`.padStart(7);
        const sP90 = `${r.p90}ms`.padStart(7);
        const sP95 = `${r.p95}ms`.padStart(7);
        const sP99 = `${r.p99}ms`.padStart(7);
        const sSuccess = `${r.successRate}%`.padStart(10);

        console.log(`${sStage} | ${sWorkers} | ${sHits} | ${sRps} | ${sAvg} | ${sP50} | ${sP90} | ${sP95} | ${sP99} | ${sSuccess}`);
    }

    console.log('-'.repeat(98));

    console.log(`\n🏆 PEAK PERFORMANCE SUMMARY:`);
    console.log(`  🌟 Maximum Hits Per Second Achieved: ${COLORS.bold}${COLORS.green}${peakRps} req/s${COLORS.reset} (at Stage ${peakStage?.stageNumber} with ${peakStage?.concurrency} concurrent workers)`);
    console.log(`  📦 Total Aggregate Hits Generated:   ${COLORS.bold}${totalAllHits} requests${COLORS.reset}`);
    console.log(`  🎯 Median Response Latency (p50):    ${peakStage?.p50} ms`);
    console.log(`  🛡️  Reliability (Success Rate):       ${peakStage?.successRate}%\n`);

    // Return structured JSON for documentation generator or file export
    return {
        stageReports,
        peakRps,
        peakStage,
        totalAllHits,
    };
}

run().catch((err) => {
    console.error('Stepped load test error:', err);
    process.exit(1);
});
