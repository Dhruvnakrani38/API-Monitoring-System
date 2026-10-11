#!/usr/bin/env node

/**
 * ============================================================================
 * PulseWatch Realistic Traffic Generator
 * ============================================================================
 * Simulates real-world production API traffic across multiple microservices,
 * endpoints, HTTP methods, status codes, and latency distributions.
 * 
 * Usage:
 *   node scripts/generate-traffic.mjs [--count 100] [--url <BASE_URL>]
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

const BASE_URL = (getArg('--url', process.env.TEST_BASE_URL || 'https://api-monitoring-system-production-b5ad.up.railway.app')).replace(/\/$/, '');
const HIT_COUNT = parseInt(getArg('--count', '100'), 10);
const ADMIN_USER = getArg('--admin-user', 'admin');
const ADMIN_PASS = getArg('--admin-pass', 'Admin@PulseWatch2026!');

const SERVICES = [
    {
        name: 'order-service',
        endpoints: [
            { path: '/api/v1/checkout', methods: ['POST'], avgLatency: 120 },
            { path: '/api/v1/orders', methods: ['GET', 'POST'], avgLatency: 65 },
            { path: '/api/v1/orders/:id/status', methods: ['GET'], avgLatency: 40 },
        ]
    },
    {
        name: 'auth-service',
        endpoints: [
            { path: '/api/v1/auth/login', methods: ['POST'], avgLatency: 85 },
            { path: '/api/v1/auth/verify', methods: ['GET'], avgLatency: 25 },
            { path: '/api/v1/auth/refresh', methods: ['POST'], avgLatency: 35 },
        ]
    },
    {
        name: 'payment-gateway',
        endpoints: [
            { path: '/api/v1/payments/charge', methods: ['POST'], avgLatency: 240 },
            { path: '/api/v1/payments/refund', methods: ['POST'], avgLatency: 180 },
            { path: '/api/v1/payments/webhook', methods: ['POST'], avgLatency: 50 },
        ]
    },
    {
        name: 'catalog-service',
        endpoints: [
            { path: '/api/v1/products/search', methods: ['GET'], avgLatency: 45 },
            { path: '/api/v1/products/:id', methods: ['GET'], avgLatency: 30 },
            { path: '/api/v1/categories', methods: ['GET'], avgLatency: 20 },
        ]
    },
    {
        name: 'notification-service',
        endpoints: [
            { path: '/api/v1/notifications/email', methods: ['POST'], avgLatency: 95 },
            { path: '/api/v1/notifications/push', methods: ['POST'], avgLatency: 40 },
        ]
    }
];

const STATUS_WEIGHTS = [
    { code: 200, weight: 80 },
    { code: 201, weight: 12 },
    { code: 400, weight: 4 },
    { code: 404, weight: 2 },
    { code: 500, weight: 2 },
];

function pickWeightedStatus() {
    const total = STATUS_WEIGHTS.reduce((sum, s) => sum + s.weight, 0);
    const rand = Math.random() * total;
    let running = 0;
    for (const s of STATUS_WEIGHTS) {
        running += s.weight;
        if (rand <= running) return s.code;
    }
    return 200;
}

function randomLatency(base) {
    const jitter = (Math.random() - 0.5) * (base * 0.6);
    // Occasional tail latency spike
    if (Math.random() < 0.05) {
        return Math.round(base * 3 + Math.random() * 200);
    }
    return Math.max(10, Math.round(base + jitter));
}

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

async function makeRequest(path, options = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
    };

    let bodyData = null;
    if (options.body) {
        bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    return new Promise((resolve, reject) => {
        const req = client.request({
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers,
            agent,
            timeout: 10000,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (bodyData) req.write(bodyData);
        req.end();
    });
}

async function obtainApiKey() {
    console.log('🔑 Logging in as SuperAdmin to acquire an active API Key...');
    const loginRes = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: { username: ADMIN_USER, password: ADMIN_PASS }
    });

    if (loginRes.statusCode !== 200 || !loginRes.body?.data?.token) {
        throw new Error(`Login failed with HTTP ${loginRes.statusCode}: ${JSON.stringify(loginRes.body)}`);
    }

    const token = loginRes.body.data.token;
    console.log('✅ Logged in successfully.');

    // Fetch existing clients
    const clientsRes = await makeRequest('/api/admin/clients', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    let clientId = null;
    if (clientsRes.statusCode === 200 && Array.isArray(clientsRes.body?.data) && clientsRes.body.data.length > 0) {
        clientId = clientsRes.body.data[0]._id;
    } else {
        // Create demo client
        console.log('📦 Creating client workspace...');
        const onboardRes = await makeRequest('/api/admin/clients/onboard', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: {
                name: 'Production Microservices',
                description: 'Real-time production cluster monitoring',
                email: 'services@pulsewatch.io'
            }
        });
        clientId = onboardRes.body?.data?._id || onboardRes.body?.data?.client?._id;
    }

    // Generate or fetch key
    console.log(`🔑 Generating monitoring API key for client [${clientId}]...`);
    const keyRes = await makeRequest(`/api/admin/clients/${clientId}/api/keys`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: { name: 'Traffic Generator Ingest Key' }
    });

    let rawKey = keyRes.body?.data?.keyValue || keyRes.body?.data?.rawKey || keyRes.body?.data?.apiKey?.key;
    if (!rawKey) {
        // Try reveal if already created
        const revealRes = await makeRequest(`/api/admin/clients/${clientId}/api/keys/reveal`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: { password: ADMIN_PASS }
        });
        if (revealRes.statusCode === 200 && Array.isArray(revealRes.body?.data) && revealRes.body.data.length > 0) {
            rawKey = revealRes.body.data[0].keyValue;
        }
    }

    if (!rawKey) {
        throw new Error('Could not obtain an unmasked API key for ingestion.');
    }

    return { apiKey: rawKey, clientId };
}

async function run() {
    console.log(`\n🚀 PulseWatch Traffic Simulator`);
    console.log(`📍 Endpoint: ${BASE_URL}`);
    console.log(`📊 Generating: ${HIT_COUNT} realistic API hit events across 5 microservices...\n`);

    const { apiKey, clientId } = await obtainApiKey();
    console.log(`✅ Using Ingestion API Key: ${apiKey.substring(0, 10)}... (Client: ${clientId})\n`);

    let sent = 0;
    let succeeded = 0;
    const start = performance.now();

    for (let i = 0; i < HIT_COUNT; i++) {
        // Pick random service & endpoint
        const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
        const endpoint = service.endpoints[Math.floor(Math.random() * service.endpoints.length)];
        const method = endpoint.methods[Math.floor(Math.random() * endpoint.methods.length)];
        const statusCode = pickWeightedStatus();
        const latencyMs = randomLatency(endpoint.avgLatency);

        const hitPayload = {
            serviceName: service.name,
            endpoint: endpoint.path.replace(':id', String(Math.floor(Math.random() * 900) + 100)),
            method,
            statusCode,
            latencyMs,
            ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
            userAgent: 'Mozilla/5.0 (ClientApp/2.4.0)',
        };

        try {
            const res = await makeRequest('/api/hit', {
                method: 'POST',
                headers: { 'x-api-key': apiKey },
                body: hitPayload,
            });

            if (res.statusCode === 200 || res.statusCode === 202) {
                succeeded++;
            }
        } catch (err) {
            // ignore network jitter
        }

        sent++;
        if (sent % 10 === 0 || sent === HIT_COUNT) {
            const pct = Math.round((sent / HIT_COUNT) * 100);
            process.stdout.write(`\r  Progress: [${'='.repeat(Math.floor(pct / 5))}${' '.repeat(20 - Math.floor(pct / 5))}] ${pct}% (${sent}/${HIT_COUNT} hits sent)`);
        }
    }

    const elapsed = Math.round((performance.now() - start) / 1000 * 10) / 10;
    console.log(`\n\n🎉 Done! Ingested ${succeeded}/${HIT_COUNT} API hits in ${elapsed}s.`);
    console.log(`📈 Refresh your dashboard at https://api-monitoring-system-six.vercel.app or http://localhost:5173 to see the updated metrics, latency distribution, and charts!`);
}

run().catch(err => {
    console.error('Traffic generator failed:', err.message);
    process.exit(1);
});
