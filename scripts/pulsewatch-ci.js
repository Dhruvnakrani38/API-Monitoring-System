#!/usr/bin/env node

/**
 * PulseWatch CI/CD Deployment Verification & Health Gate CLI
 * 
 * Usage in CI/CD (GitHub Actions / GitLab CI / Jenkins):
 *   node scripts/pulsewatch-ci.js --url http://localhost:5000 --token <JWT_OR_API_KEY> [--client-id <CLIENT_ID>]
 */

import http from 'http';
import https from 'https';

const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return defaultValue;
}

const targetUrl = getArg('--url', process.env.PULSEWATCH_URL || 'http://localhost:5000');
const token = getArg('--token', process.env.PULSEWATCH_TOKEN);
const clientId = getArg('--client-id', process.env.PULSEWATCH_CLIENT_ID);

console.log('🚀 PulseWatch CI/CD Deployment Verification Gate');
console.log(`📍 PulseWatch Endpoint: ${targetUrl}`);

if (!token) {
    console.error('❌ Error: Missing --token or PULSEWATCH_TOKEN environment variable.');
    process.exit(1);
}

async function triggerVerification() {
    const endpoint = new URL('/api/synthetics/trigger-all', targetUrl);
    if (clientId) endpoint.searchParams.append('clientId', clientId);

    const isHttps = endpoint.protocol === 'https:';
    const requestLib = isHttps ? https : http;

    const options = {
        hostname: endpoint.hostname,
        port: endpoint.port || (isHttps ? 443 : 80),
        path: endpoint.pathname + endpoint.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        },
    };

    return new Promise((resolve, reject) => {
        const req = requestLib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, body: parsed });
                } catch (err) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });

        req.on('error', err => reject(err));
        req.end();
    });
}

async function run() {
    try {
        console.log('⏳ Triggering synthetic API checks verification...');
        const response = await triggerVerification();

        if (response.statusCode >= 400) {
            console.error(`❌ CI Verification request failed with HTTP ${response.statusCode}`);
            console.error(JSON.stringify(response.body, null, 2));
            process.exit(1);
        }

        const report = response.body?.data || response.body;
        console.log('\n📊 Synthetic Check Verification Results:');
        console.log(`----------------------------------------`);
        console.log(`Total Checks: ${report.totalChecks}`);
        console.log(`Passed:       ${report.passedChecks}`);
        console.log(`Failed:       ${report.totalChecks - report.passedChecks}`);
        console.log(`----------------------------------------\n`);

        if (Array.isArray(report.results)) {
            for (const r of report.results) {
                const icon = r.success ? '✅ PASS' : '❌ FAIL';
                const statusStr = r.statusCode ? `[HTTP ${r.statusCode}]` : '';
                const latencyStr = r.latencyMs ? `(${r.latencyMs}ms)` : '';
                console.log(`${icon} - ${r.name} ${statusStr} ${latencyStr}`);
                if (!r.success && r.errorMessage) {
                    console.log(`   └── Error: ${r.errorMessage}`);
                }
            }
        }

        if (report.allPassed) {
            console.log('\n🎉 All synthetic API checks PASSED! Deployment verified healthy.');
            process.exit(0);
        } else {
            console.error('\n💥 Post-deployment verification FAILED. One or more synthetic checks failed.');
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Error executing PulseWatch CI verification:', err.message);
        process.exit(1);
    }
}

run();
