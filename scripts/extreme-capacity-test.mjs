#!/usr/bin/env node

/**
 * ============================================================================
 * PulseWatch Extreme Capacity & Breaking Point Benchmark (Test-2)
 * ============================================================================
 * High-stress ramp test designed to evaluate extreme throughput capacity:
 *   - Starts at 1,000 target requests/second (10s window)
 *   - Increases every 10 seconds by +1,000 req/s target (2,000 -> 3,000 -> 4,000...)
 *   - Attempts ramp-up towards 100,000 req/s
 *   - Identifies the exact hardware saturation ceiling, network bottleneck,
 *     and breaking point of the deployment.
 * 
 * Usage:
 *   node scripts/extreme-capacity-test.mjs [--url <URL>] [--endpoint /health] [--start-rps 1000] [--step-rps 1000] [--step-sec 10] [--max-rps 100000]
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
const BASE_URL = (getArg('--url', process.env.TEST_BASE_URL || 'https://api-monitoring-system-production-b5ad.up.railway.app')).replace(/\/$/, '');
const ENDPOINT = getArg('--endpoint', DEFAULT_ENDPOINT);
const START_RPS = parseInt(getArg('--start-rps', '1000'), 10);
const STEP_RPS = parseInt(getArg('--step-rps', '1000'), 10);
const STEP_DURATION_SEC = parseInt(getArg('--step-sec', '10'), 10);
const MAX_RPS = parseInt(getArg('--max-rps', '100000'), 10);
const MAX_STAGES = parseInt(getArg('--max-stages', '10'), 10); // Run up to 10 stepped stages by default
const API_KEY = getArg('--api-key', 'apim_eebfd7753595177a3bd2cfde83004a2b65b95752');

const CLIENT_ENDPOINTS = [
    { service: 'order-service', endpoint: '/api/v1/orders', method: 'GET', baseLatency: 65 },
    { service: 'order-service', endpoint: '/api/v1/orders/checkout', method: 'POST', baseLatency: 140 },
    { service: 'catalog-service', endpoint: '/api/v1/products', method: 'GET', baseLatency: 35 },
    { service: 'catalog-service', endpoint: '/api/v1/categories', method: 'GET', baseLatency: 22 },
    { service: 'auth-service', endpoint: '/api/v1/auth/login', method: 'POST', baseLatency: 85 },
    { service: 'payment-service', endpoint: '/api/v1/payments/charge', method: 'POST', baseLatency: 210 },
    { service: 'notification-service', endpoint: '/api/v1/notifications/email', method: 'POST', baseLatency: 95 },
];

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

// Reusable Keep-Alive agents configured for extreme concurrency
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 2500, maxFreeSockets: 500, timeout: 8000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 2500, maxFreeSockets: 500, timeout: 8000 });

function calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

function executeFastRequest(urlObj) {
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const start = performance.now();

    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'PulseWatch-Extreme-Capacity-Tester/2.0',
    };

    let bodyData = null;
    let method = 'GET';

    if (IS_INGEST) {
        method = 'POST';
        headers['Content-Type'] = 'application/json';
        headers['x-api-key'] = API_KEY;
        const ep = CLIENT_ENDPOINTS[Math.floor(Math.random() * CLIENT_ENDPOINTS.length)];
        bodyData = JSON.stringify({
            serviceName: ep.service,
            endpoint: ep.endpoint,
            method: ep.method,
            statusCode: 200,
            latencyMs: ep.baseLatency,
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
            timeout: 8000,
        }, (res) => {
            res.on('data', () => {}); // rapidly drain socket
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
                error: err.message || 'Network error',
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
 * Runs a 10-second stage attempting to achieve the target RPS
 * Concurrency is scaled dynamically based on Little's Law to maintain the target throughput.
 */
async function runStage({ stageNumber, targetRps, durationSec, urlObj }) {
    console.log(`\n${COLORS.bold}━━━ [Stage ${stageNumber}] Target: ${targetRps.toLocaleString()} req/s | Duration: ${durationSec}s ━━━${COLORS.reset}`);

    // Concurrency calculation: TargetRPS * estimated RTT (~0.3s)
    // For 1,000 RPS -> ~300 workers; For 2,000 RPS -> ~600 workers; Max capped at 1,500 local workers
    const concurrency = Math.min(1500, Math.max(100, Math.round(targetRps * 0.35)));
    console.log(`  ⚙️  Worker Pool:  ${COLORS.cyan}${concurrency} concurrent pipeline workers${COLORS.reset}`);

    const stageResults = [];
    let completed = 0;
    const stageStartTime = performance.now();
    const stageDeadline = stageStartTime + (durationSec * 1000);

    const updateInterval = setInterval(() => {
        const elapsedSec = (performance.now() - stageStartTime) / 1000;
        const currentRps = Math.round(completed / Math.max(0.1, elapsedSec));
        const remainingSec = Math.max(0, Math.ceil(durationSec - elapsedSec));
        process.stdout.write(`\r  Running: Hits: ${completed.toLocaleString()} | Achieved: ${currentRps.toLocaleString()} req/s | Target: ${targetRps.toLocaleString()} req/s | Left: ${remainingSec}s `);
    }, 250);

    async function worker() {
        while (performance.now() < stageDeadline) {
            try {
                const res = await executeFastRequest(urlObj);
                stageResults.push(res);
                completed++;
            } catch (err) {
                stageResults.push({ success: false, statusCode: 0, latency: 0, error: err.message });
                completed++;
            }
        }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) workers.push(worker());
    await Promise.all(workers);

    clearInterval(updateInterval);
    process.stdout.write('\r' + ' '.repeat(100) + '\r'); // clear line

    const actualDurationSec = (performance.now() - stageStartTime) / 1000;
    const totalHits = stageResults.length;
    const achievedRps = Math.round((totalHits / actualDurationSec) * 10) / 10;

    const latencies = stageResults.map(r => r.latency).sort((a, b) => a - b);
    const successful = stageResults.filter(r => r.success).length;
    const failed = totalHits - successful;
    const successRate = totalHits > 0 ? ((successful / totalHits) * 100).toFixed(1) : '0.0';

    const minLat = latencies[0] || 0;
    const maxLat = latencies[latencies.length - 1] || 0;
    const avgLat = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
    const p50 = calculatePercentile(latencies, 50);
    const p90 = calculatePercentile(latencies, 90);
    const p95 = calculatePercentile(latencies, 95);
    const p99 = calculatePercentile(latencies, 99);

    const rpsEfficiency = Math.round((achievedRps / targetRps) * 100);

    console.log(`  ⏱️  Completed:   ${COLORS.bold}${totalHits.toLocaleString()}${COLORS.reset} requests in ${actualDurationSec.toFixed(2)}s`);
    console.log(`  ⚡ Achieved RPS:${COLORS.bold}${COLORS.green}${achievedRps.toLocaleString()} req/s${COLORS.reset} (${rpsEfficiency}% of ${targetRps.toLocaleString()} target)`);
    console.log(`  📊 Success:     ${COLORS.green}${successful.toLocaleString()}${COLORS.reset} (${successRate}%) | Errors/Timeouts: ${failed > 0 ? COLORS.red : COLORS.dim}${failed.toLocaleString()}${COLORS.reset}`);
    console.log(`  📈 Latency:     p50: ${p50}ms | p90: ${p90}ms | p95: ${p95}ms | p99: ${p99}ms | Avg: ${avgLat}ms`);

    return {
        stageNumber,
        targetRps,
        concurrency,
        durationSec: actualDurationSec.toFixed(1),
        totalHits,
        achievedRps,
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
        rpsEfficiency,
    };
}

async function run() {
    console.log(`\n================================================================================`);
    console.log(`🚀 PulseWatch Extreme Capacity & Breaking Point Benchmark (Test-2)`);
    console.log(`================================================================================`);
    console.log(`  📍 Target:        ${COLORS.cyan}${BASE_URL}${ENDPOINT}${COLORS.reset}`);
    console.log(`  ⏱️  Stage Window:  ${COLORS.bold}${STEP_DURATION_SEC} seconds per stage${COLORS.reset}`);
    console.log(`  📈 Ramp Pattern:  Starts @ ${START_RPS.toLocaleString()} req/s, increases by +${STEP_RPS.toLocaleString()} req/s every 10s`);
    console.log(`  🎯 Upper Goal:    Up towards ${MAX_RPS.toLocaleString()} req/s (or until breaking point)`);
    console.log(`================================================================================\n`);

    const urlObj = new URL(`${BASE_URL}${ENDPOINT}`);
    const stageReports = [];
    let currentTargetRps = START_RPS;
    let stageIndex = 1;

    while (currentTargetRps <= MAX_RPS && stageIndex <= MAX_STAGES) {
        const report = await runStage({
            stageNumber: stageIndex,
            targetRps: currentTargetRps,
            durationSec: STEP_DURATION_SEC,
            urlObj,
        });

        stageReports.push(report);

        // Breaking point condition: If success rate drops below 50% or severe socket drops occur
        if (parseFloat(report.successRate) < 50) {
            console.log(`\n${COLORS.red}🛑 SYSTEM BREAKING POINT DETECTED!${COLORS.reset}`);
            console.log(`  Success rate dropped to ${report.successRate}% at ${currentTargetRps.toLocaleString()} target req/s.`);
            console.log(`  Stopping ramp to prevent persistent outage of production container.\n`);
            break;
        }

        // If throughput plateaued completely (achieved RPS not growing by more than 5% for 2 stages)
        if (stageIndex >= 4) {
            const last3 = stageReports.slice(-3);
            const rpsVariance = Math.abs(last3[2].achievedRps - last3[0].achievedRps) / last3[0].achievedRps;
            if (rpsVariance < 0.05 && last3[2].p99 > 8000) {
                console.log(`\n${COLORS.yellow}⚠️ HARDWARE & CONTAINER SATURATION CEILING REACHED!${COLORS.reset}`);
                console.log(`  Container has saturated at ~${Math.round(last3[2].achievedRps)} req/s. Concurrency queueing detected.\n`);
                break;
            }
        }

        if (currentTargetRps + STEP_RPS <= MAX_RPS && stageIndex < MAX_STAGES) {
            process.stdout.write(`  ⏳ 3s socket stabilization cooldown...\n`);
            await new Promise(r => setTimeout(r, 3000));
        }

        currentTargetRps += STEP_RPS;
        stageIndex++;
    }

    // =========================================================================
    // FINAL COMPREHENSIVE MATRIX REPORT
    // =========================================================================
    console.log(`\n\n================================================================================`);
    console.log(`📊 PULSEWATCH TEST-2 EXTREME CAPACITY PERFORMANCE MATRIX`);
    console.log(`================================================================================\n`);

    const colStage = 'Stage'.padEnd(7);
    const colTarget = 'Target RPS'.padStart(12);
    const colWorkers = 'Workers'.padStart(9);
    const colHits = 'Total Hits'.padStart(12);
    const colAchieved = 'Achieved RPS'.padStart(14);
    const colAvg = 'Avg Lat'.padStart(9);
    const colP50 = 'p50'.padStart(7);
    const colP90 = 'p90'.padStart(7);
    const colP95 = 'p95'.padStart(7);
    const colP99 = 'p99'.padStart(7);
    const colSuccess = 'Success %'.padStart(10);

    console.log(`${colStage} | ${colTarget} | ${colWorkers} | ${colHits} | ${colAchieved} | ${colAvg} | ${colP50} | ${colP90} | ${colP95} | ${colP99} | ${colSuccess}`);
    console.log('-'.repeat(116));

    let peakRps = 0;
    let peakStage = null;
    let totalAllHits = 0;

    for (const r of stageReports) {
        totalAllHits += r.totalHits;
        if (r.achievedRps > peakRps) {
            peakRps = r.achievedRps;
            peakStage = r;
        }

        const sStage = `Stage ${r.stageNumber}`.padEnd(7);
        const sTarget = `${r.targetRps.toLocaleString()}`.padStart(12);
        const sWorkers = `${r.concurrency}`.padStart(9);
        const sHits = `${r.totalHits.toLocaleString()}`.padStart(12);
        const sAchieved = `${r.achievedRps.toLocaleString()}`.padStart(14);
        const sAvg = `${r.avgLat}ms`.padStart(9);
        const sP50 = `${r.p50}ms`.padStart(7);
        const sP90 = `${r.p90}ms`.padStart(7);
        const sP95 = `${r.p95}ms`.padStart(7);
        const sP99 = `${r.p99}ms`.padStart(7);
        const sSuccess = `${r.successRate}%`.padStart(10);

        console.log(`${sStage} | ${sTarget} | ${sWorkers} | ${sHits} | ${sAchieved} | ${sAvg} | ${sP50} | ${sP90} | ${sP95} | ${sP99} | ${sSuccess}`);
    }

    console.log('-'.repeat(116));

    console.log(`\n🏆 TEST-2 SUMMARY & CAPACITY FINDINGS:`);
    console.log(`  🌟 Maximum Achieved Throughput:  ${COLORS.bold}${COLORS.green}${peakRps.toLocaleString()} req/s${COLORS.reset} (Stage ${peakStage?.stageNumber} @ ${peakStage?.concurrency} workers)`);
    console.log(`  📦 Total Aggregate Volume:       ${COLORS.bold}${totalAllHits.toLocaleString()} requests${COLORS.reset}`);
    console.log(`  🎯 Median Latency at Peak:       ${peakStage?.p50} ms`);
    console.log(`  🛡️  Success Rate at Peak:        ${peakStage?.successRate}%\n`);

    return { stageReports, peakRps, peakStage, totalAllHits };
}

run().catch(err => {
    console.error('Test-2 execution failed:', err);
    process.exit(1);
});
