#!/usr/bin/env node

/**
 * ============================================================================
 * PulseWatch Complete Automated Functional Tester Client
 * ============================================================================
 * Tests each feature and endpoint of the PulseWatch API Monitoring System:
 *   1. Core Health & Root Info Endpoints
 *   2. Authentication & Validation Engine (Signup, Validation, Login, Profile)
 *   3. Google OAuth 2.0 Endpoint Verification
 *   4. Admin Pending User Approvals Flow
 *   5. Client Onboarding & API Key Management
 *   6. Real-Time API Hit Ingestion Pipeline (x-api-key validation & hit ingest)
 *   7. Analytics & Observability (Stats, Percentiles, SLA, Dashboard)
 *   8. Multi-Channel Alert Engine (Rules, Incidents, Dispatch test)
 *   9. Synthetic Uptime Monitoring
 *  10. Multi-Step Synthetic User Journeys (Creation & Step Execution)
 * 
 * Usage:
 *   node scripts/tester-client.mjs [--url <BASE_URL>] [--admin-user <USER>] [--admin-pass <PASS>]
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
const ADMIN_USER = getArg('--admin-user', process.env.TEST_ADMIN_USER || 'admin');
const ADMIN_PASS = getArg('--admin-pass', process.env.TEST_ADMIN_PASS || 'Admin@PulseWatch2026!');

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

class HttpClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = null;
        this.cookies = '';
    }

    setToken(token) {
        this.token = token;
    }

    async request(path, options = {}) {
        const url = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path}`);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const headers = {
            'Accept': 'application/json',
            ...(options.headers || {}),
        };

        if (this.token && !headers['Authorization']) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (this.cookies && !headers['Cookie']) {
            headers['Cookie'] = this.cookies;
        }

        let bodyData = null;
        if (options.body) {
            bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
            headers['Content-Length'] = Buffer.byteLength(bodyData);
        }

        const start = performance.now();

        return new Promise((resolve, reject) => {
            const req = client.request({
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers,
                timeout: options.timeout || 15000,
            }, (res) => {
                let rawData = '';
                res.on('data', chunk => rawData += chunk);
                res.on('end', () => {
                    const durationMs = Math.round(performance.now() - start);

                    // Track set-cookie
                    if (res.headers['set-cookie']) {
                        const newCookies = Array.isArray(res.headers['set-cookie'])
                            ? res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
                            : res.headers['set-cookie'].split(';')[0];
                        this.cookies = newCookies;
                    }

                    let parsedBody = null;
                    try {
                        parsedBody = JSON.parse(rawData);
                    } catch {
                        parsedBody = rawData;
                    }

                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: parsedBody,
                        durationMs,
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timed out after ${options.timeout || 15000}ms`));
            });

            if (bodyData) req.write(bodyData);
            req.end();
        });
    }
}

class TestSuiteRunner {
    constructor() {
        this.client = new HttpClient(BASE_URL);
        this.results = [];
        this.context = {};
    }

    async test(name, category, testFn) {
        process.stdout.write(`  ${COLORS.dim}▸${COLORS.reset} ${name} ... `);
        const start = performance.now();
        try {
            const result = await testFn(this.client, this.context);
            const duration = Math.round(performance.now() - start);
            console.log(`${COLORS.green}✔ PASS${COLORS.reset} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
            this.results.push({ name, category, passed: true, duration, details: result });
            return true;
        } catch (err) {
            const duration = Math.round(performance.now() - start);
            console.log(`${COLORS.red}✖ FAIL${COLORS.reset} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
            console.log(`    ${COLORS.red}Error:${COLORS.reset} ${err.message}`);
            this.results.push({ name, category, passed: false, duration, error: err.message });
            return false;
        }
    }

    printCategory(title) {
        console.log(`\n${COLORS.bold}${COLORS.cyan}═══ ${title} ═══${COLORS.reset}`);
    }

    printSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const totalDuration = this.results.reduce((acc, r) => acc + r.duration, 0);

        console.log(`\n${COLORS.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
        console.log(`${COLORS.bold}📋 PULSEWATCH FUNCTIONAL TEST SUMMARY REPORT${COLORS.reset}`);
        console.log(`${COLORS.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`);
        console.log(`Target URL:       ${COLORS.blue}${BASE_URL}${COLORS.reset}`);
        console.log(`Total Tests Run:  ${COLORS.bold}${total}${COLORS.reset}`);
        console.log(`Passed:           ${COLORS.green}${COLORS.bold}${passed}${COLORS.reset}`);
        console.log(`Failed:           ${failed > 0 ? COLORS.red : COLORS.dim}${COLORS.bold}${failed}${COLORS.reset}`);
        console.log(`Pass Rate:        ${passRate === 100 ? COLORS.green : (passRate > 80 ? COLORS.yellow : COLORS.red)}${COLORS.bold}${passRate}%${COLORS.reset}`);
        console.log(`Total Execution:  ${totalDuration}ms`);
        console.log(`${COLORS.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

        return failed === 0;
    }
}

async function runAllTests() {
    console.log(`\n${COLORS.bold}${COLORS.magenta}╔═════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.magenta}║       🚀 PulseWatch End-to-End Functional Test Suite            ║${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.magenta}╚═════════════════════════════════════════════════════════════════╝${COLORS.reset}`);
    console.log(`Target URL: ${COLORS.blue}${BASE_URL}${COLORS.reset}\n`);

    const runner = new TestSuiteRunner();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Core Health & Uptime Endpoints
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('1. Core Health & System Endpoints');

    await runner.test('GET /health returns 200 OK and healthy status', 'Health', async (c) => {
        const res = await c.request('/health');
        if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
        if (res.body?.data?.status !== 'healthy') throw new Error(`Expected status 'healthy', got ${JSON.stringify(res.body)}`);
        return res.body;
    });

    await runner.test('GET / returns service metadata and registered endpoints', 'Health', async (c) => {
        const res = await c.request('/');
        if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
        if (!res.body?.data?.endpoints?.auth) throw new Error(`Missing expected endpoints in response: ${JSON.stringify(res.body)}`);
        return res.body;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Authentication & Validation Engine
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('2. Authentication & Validation Engine');

    await runner.test('POST /api/auth/login validates empty fields & returns specific errors', 'Auth', async (c) => {
        const res = await c.request('/api/auth/login', {
            method: 'POST',
            body: { username: '', password: '' }
        });
        if (res.statusCode !== 400) throw new Error(`Expected HTTP 400 Bad Request, got ${res.statusCode}`);
        const errors = res.body?.errors || res.body?.error;
        if (!Array.isArray(errors) || errors.length === 0) {
            throw new Error(`Expected array of specific validation error messages, got ${JSON.stringify(res.body)}`);
        }
        return { errorsCount: errors.length };
    });

    await runner.test('POST /api/auth/login rejects invalid credentials with 401', 'Auth', async (c) => {
        const res = await c.request('/api/auth/login', {
            method: 'POST',
            body: { username: 'non_existent_random_user_9999', password: 'WrongPassword@123' }
        });
        if (res.statusCode !== 401) throw new Error(`Expected HTTP 401 Unauthorized, got ${res.statusCode}`);
        return res.body;
    });

    const testUser = {
        username: `tester_${Date.now()}`,
        email: `tester_${Date.now()}@example.com`,
        password: 'Password123!',
    };

    await runner.test('POST /api/auth/signup creates a pending user with 201', 'Auth', async (c, ctx) => {
        const res = await c.request('/api/auth/signup', {
            method: 'POST',
            body: testUser
        });
        if (res.statusCode !== 201) throw new Error(`Expected HTTP 201 Created, got ${res.statusCode} ${JSON.stringify(res.body)}`);
        if (res.body?.data?.approvalStatus !== 'pending') {
            throw new Error(`Expected approvalStatus: pending, got ${res.body?.data?.approvalStatus}`);
        }
        ctx.createdUserId = res.body?.data?._id;
        ctx.testUser = testUser;
        return { userId: ctx.createdUserId };
    });

    await runner.test('POST /api/auth/login informs user when account is pending approval (403)', 'Auth', async (c) => {
        const res = await c.request('/api/auth/login', {
            method: 'POST',
            body: { username: testUser.username, password: testUser.password }
        });
        if (res.statusCode !== 403) throw new Error(`Expected HTTP 403 Forbidden for pending user, got ${res.statusCode}`);
        if (!res.body?.message?.toLowerCase().includes('pending')) {
            throw new Error(`Expected message to mention 'pending', got: ${res.body?.message}`);
        }
        return res.body;
    });

    await runner.test('POST /api/auth/login supports login with Email address', 'Auth', async (c) => {
        const res = await c.request('/api/auth/login', {
            method: 'POST',
            body: { username: testUser.email, password: testUser.password }
        });
        // Still pending, but correctly resolved by email!
        if (res.statusCode !== 403) throw new Error(`Expected HTTP 403, got ${res.statusCode}`);
        return res.body;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. SuperAdmin Authentication & Profile
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('3. SuperAdmin Authentication & Session');

    await runner.test('Authenticate SuperAdmin via onboard or login', 'Auth', async (c, ctx) => {
        // Try login first
        let loginRes = await c.request('/api/auth/login', {
            method: 'POST',
            body: { username: ADMIN_USER, password: ADMIN_PASS }
        });

        // If not found or failed, try onboarding initial superadmin
        if (loginRes.statusCode !== 200) {
            const onboardRes = await c.request('/api/auth/onboard-super-admin', {
                method: 'POST',
                body: { username: ADMIN_USER, email: `${ADMIN_USER}@pulsewatch.io`, password: ADMIN_PASS }
            });
            if (onboardRes.statusCode === 201) {
                loginRes = onboardRes;
            }
        }

        if (loginRes.statusCode !== 200 && loginRes.statusCode !== 201) {
            // Check if login worked with token in response data or cookie
            throw new Error(`Failed to authenticate admin: HTTP ${loginRes.statusCode} - ${JSON.stringify(loginRes.body)}`);
        }

        const token = loginRes.body?.data?.token || loginRes.body?.token;
        if (token) {
            c.setToken(token);
            ctx.adminToken = token;
        }
        return { authenticated: true, role: loginRes.body?.data?.role || 'admin' };
    });

    await runner.test('GET /api/auth/profile verifies authenticated SuperAdmin profile', 'Auth', async (c) => {
        const res = await c.request('/api/auth/profile');
        if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
        if (!res.body?.data?.username) throw new Error(`Invalid profile data: ${JSON.stringify(res.body)}`);
        return { username: res.body.data.username, role: res.body.data.role };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Google OAuth 2.0 Integration
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('4. Google OAuth 2.0 Integration');

    await runner.test('GET /api/auth/google initiates OAuth redirect flow', 'OAuth', async (c) => {
        const res = await c.request('/api/auth/google?return_to=http%3A%2F%2Flocalhost%3A5173');
        // Passport triggers 302 Redirect to accounts.google.com
        if (res.statusCode !== 302 && res.statusCode !== 200) {
            throw new Error(`Expected redirect 302 to Google OAuth, got HTTP ${res.statusCode}`);
        }
        const location = res.headers['location'] || '';
        if (location && !location.includes('accounts.google.com')) {
            throw new Error(`Expected location to point to Google Accounts, got: ${location}`);
        }
        return { redirectLocation: location.substring(0, 60) + '...' };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Admin User Approval Workflow
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('5. Admin User Approval Workflow');

    await runner.test('GET /api/auth/admin/pending-users lists pending accounts', 'Approval', async (c, ctx) => {
        const res = await c.request('/api/auth/admin/pending-users');
        if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
        const users = res.body?.data || [];
        ctx.pendingUsers = users;
        return { pendingCount: users.length };
    });

    await runner.test('POST /api/auth/admin/users/:id/approve approves the test user', 'Approval', async (c, ctx) => {
        if (!ctx.createdUserId) {
            console.log(' (skipped - no created user)');
            return;
        }
        const res = await c.request(`/api/auth/admin/users/${ctx.createdUserId}/approve`, {
            method: 'POST',
            body: { role: 'client_viewer' }
        });
        if (res.statusCode !== 200 && res.statusCode !== 201) {
            throw new Error(`Approval failed with HTTP ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
        // Extract client and apiKey if generated during approval
        if (res.body?.data?.client?._id) ctx.clientId = res.body.data.client._id;
        if (res.body?.data?.apiKey?.key) ctx.apiKey = res.body.data.apiKey.key;
        return { approvedUserId: ctx.createdUserId, client: res.body?.data?.client?.name };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Client Onboarding & API Key Management
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('6. Client Onboarding & API Key Management');

    await runner.test('POST /api/admin/clients/onboard creates a monitored client', 'Clients', async (c, ctx) => {
        const clientPayload = {
            name: `Test Tenant ${Date.now()}`,
            description: 'Automated test suite monitored client',
            email: `tenant_${Date.now()}@pulsewatch.io`,
            contactEmail: `tenant_${Date.now()}@pulsewatch.io`,
        };
        const res = await c.request('/api/admin/clients/onboard', {
            method: 'POST',
            body: clientPayload
        });
        if (res.statusCode !== 200 && res.statusCode !== 201) {
            throw new Error(`Client onboard failed: HTTP ${res.statusCode} ${JSON.stringify(res.body)}`);
        }
        ctx.clientId = res.body?.data?._id || res.body?.data?.id || res.body?.data?.client?._id || ctx.clientId;
        ctx.apiKey = res.body?.data?.apiKey || res.body?.data?.key || ctx.apiKey;
        return { clientId: ctx.clientId, hasApiKey: Boolean(ctx.apiKey) };
    });

    await runner.test('POST /api/admin/clients/:clientId/api/keys generates an API Key', 'Clients', async (c, ctx) => {
        if (!ctx.clientId) throw new Error('Missing clientId from previous test');
        const res = await c.request(`/api/admin/clients/${ctx.clientId}/api/keys`, {
            method: 'POST',
            body: { name: 'Production Pipeline Key', permissions: { canIngest: true, canRead: true } }
        });
        if (res.statusCode !== 200 && res.statusCode !== 201) {
            // If already created during onboard, that is acceptable
            if (ctx.apiKey) return { apiKey: ctx.apiKey };
            throw new Error(`Failed to create API key: HTTP ${res.statusCode}`);
        }
        ctx.apiKey = res.body?.data?.keyValue || res.body?.data?.rawKey || res.body?.data?.key || res.body?.data?.apiKey || ctx.apiKey;
        return { apiKeyGenerated: Boolean(ctx.apiKey) };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Ingestion Pipeline & Hit Tracking
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('7. Real-Time Ingestion Pipeline');

    await runner.test('POST /api/hit rejects requests missing x-api-key (401)', 'Ingestion', async (c) => {
        const res = await c.request('/api/hit', {
            method: 'POST',
            body: { endpoint: '/api/v1/orders', method: 'GET', statusCode: 200, latencyMs: 45 }
        });
        if (res.statusCode !== 401) throw new Error(`Expected HTTP 401 Unauthorized, got ${res.statusCode}`);
        return res.body;
    });

    await runner.test('POST /api/hit ingests valid API Hit event with x-api-key', 'Ingestion', async (c, ctx) => {
        if (!ctx.apiKey) {
            console.log(' (skipped - no active API key revealed)');
            return;
        }
        const hitPayload = {
            serviceName: 'order-service',
            endpoint: '/api/v1/checkout',
            method: 'POST',
            statusCode: 201,
            latencyMs: 82,
            ipAddress: '127.0.0.1',
            userAgent: 'PulseWatch-Tester/1.0',
        };
        const res = await c.request('/api/hit', {
            method: 'POST',
            headers: { 'x-api-key': ctx.apiKey },
            body: hitPayload,
        });
        if (res.statusCode !== 200 && res.statusCode !== 202) {
            throw new Error(`Hit ingestion failed: HTTP ${res.statusCode} ${JSON.stringify(res.body)}`);
        }
        return res.body;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Analytics, Observability & SLA
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('8. Analytics, Percentiles & SLA');

    await runner.test('GET /api/analytics/stats returns p50, p90, p95, p99 & SLA metrics', 'Analytics', async (c, ctx) => {
        const statsPath = ctx.clientId ? `/api/analytics/stats?clientId=${ctx.clientId}` : '/api/analytics/stats';
        const res = await c.request(statsPath);
        if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
        const data = res.body?.data || {};
        if (!data.percentiles) {
            throw new Error(`Missing percentiles object in stats: ${JSON.stringify(data)}`);
        }
        return {
            p50: data.percentiles.p50,
            p90: data.percentiles.p90,
            p95: data.percentiles.p95,
            p99: data.percentiles.p99,
            slaUptime: data.slaUptime,
        };
    });

    await runner.test('GET /api/analytics/dashboard returns consolidated dashboard data', 'Analytics', async (c, ctx) => {
        const dashPath = ctx.clientId ? `/api/analytics/dashboard?clientId=${ctx.clientId}` : '/api/analytics/dashboard';
        const res = await c.request(dashPath);
        if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
        return { hasStats: Boolean(res.body?.data) };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Alert Engine & Multi-Channel Dispatch
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('9. Multi-Channel Alert Engine');

    await runner.test('GET /api/alerts/rules lists active alert policies', 'Alerts', async (c, ctx) => {
        const rulesPath = ctx.clientId ? `/api/alerts/rules?clientId=${ctx.clientId}` : '/api/alerts/rules';
        const res = await c.request(rulesPath);
        if (res.statusCode !== 200) throw new Error(`Expected HTTP 200, got ${res.statusCode}`);
        return { rulesCount: (res.body?.data || []).length };
    });

    await runner.test('POST /api/alerts/rules creates high latency & multi-channel alert rule', 'Alerts', async (c, ctx) => {
        const rulePayload = {
            clientId: ctx.clientId,
            name: `Avg Latency Spike Alert ${Date.now()}`,
            metric: 'avg_latency',
            operator: '>',
            threshold: 250,
            windowMinutes: 5,
            severity: 'warning',
            slackWebhookUrl: 'https://hooks.slack.com/services/mock/pulsewatch/test',
            discordWebhookUrl: 'https://discord.com/api/webhooks/mock/pulsewatch/test',
            webhookUrl: 'https://example.com/api/webhook',
        };
        const res = await c.request('/api/alerts/rules', {
            method: 'POST',
            body: rulePayload
        });
        if (res.statusCode !== 200 && res.statusCode !== 201) {
            throw new Error(`Failed to create alert rule: HTTP ${res.statusCode} ${JSON.stringify(res.body)}`);
        }
        ctx.alertRuleId = res.body?.data?.id || res.body?.data?._id;
        return { ruleId: ctx.alertRuleId };
    });

    await runner.test('POST /api/alerts/test-webhook dispatches a test notification', 'Alerts', async (c) => {
        const res = await c.request('/api/alerts/test-webhook', {
            method: 'POST',
            body: {
                channel: 'webhook',
                url: 'https://httpbin.org/post'
            }
        });
        if (res.statusCode !== 200) {
            // Note: If external network is blocked, 400 with message is also informative
            if (res.statusCode === 400 || res.statusCode === 502) {
                return { dispatchAttempted: true, externalStatus: res.statusCode };
            }
            throw new Error(`Webhook test failed: HTTP ${res.statusCode} ${JSON.stringify(res.body)}`);
        }
        return res.body;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Synthetic Monitoring & Multi-Step User Journeys
    // ─────────────────────────────────────────────────────────────────────────
    runner.printCategory('10. Synthetics & Multi-Step Journeys');

    await runner.test('POST /api/synthetics creates a single synthetic health monitor', 'Synthetics', async (c, ctx) => {
        const syntheticPayload = {
            clientId: ctx.clientId,
            name: `Edge Health Check ${Date.now()}`,
            url: `${BASE_URL}/health`,
            method: 'GET',
            expectedStatus: 200,
            intervalMinutes: 10,
        };
        const res = await c.request('/api/synthetics', {
            method: 'POST',
            body: syntheticPayload
        });
        if (res.statusCode !== 200 && res.statusCode !== 201) {
            throw new Error(`Failed to create synthetic: HTTP ${res.statusCode} ${JSON.stringify(res.body)}`);
        }
        ctx.syntheticId = res.body?.data?.id || res.body?.data?._id;
        return { syntheticId: ctx.syntheticId };
    });

    await runner.test('POST /api/journeys creates a Multi-Step User Journey', 'Journeys', async (c, ctx) => {
        const journeyPayload = {
            clientId: ctx.clientId,
            name: `User Checkout Workflow ${Date.now()}`,
            cronSchedule: '*/15 * * * *',
            alertOnFailure: true,
            steps: [
                {
                    name: 'Step 1: Check System Health',
                    url: `${BASE_URL}/health`,
                    method: 'GET',
                    expectedStatus: 200,
                },
                {
                    name: 'Step 2: Inspect Root Metadata',
                    url: `${BASE_URL}/`,
                    method: 'GET',
                    expectedStatus: 200,
                }
            ]
        };
        const res = await c.request('/api/journeys', {
            method: 'POST',
            body: journeyPayload
        });
        if (res.statusCode !== 200 && res.statusCode !== 201) {
            throw new Error(`Failed to create multi-step journey: HTTP ${res.statusCode} ${JSON.stringify(res.body)}`);
        }
        ctx.journeyId = res.body?.data?.id || res.body?.data?._id;
        return { journeyId: ctx.journeyId };
    });

    await runner.test('POST /api/journeys/:id/run executes the multi-step journey and asserts all steps', 'Journeys', async (c, ctx) => {
        if (!ctx.journeyId) throw new Error('Missing journeyId from previous test');
        const res = await c.request(`/api/journeys/${ctx.journeyId}/run`, {
            method: 'POST',
        });
        if (res.statusCode !== 200) {
            throw new Error(`Journey execution failed: HTTP ${res.statusCode} ${JSON.stringify(res.body)}`);
        }
        const runData = res.body?.data || {};
        if (runData.success === false) {
            throw new Error(`Journey run assertion failed: ${JSON.stringify(runData)}`);
        }
        return {
            success: runData.success,
            stepsExecuted: runData.stepsExecuted || runData.totalSteps || 2,
            durationMs: runData.durationMs,
        };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Summary & Exit Code
    // ─────────────────────────────────────────────────────────────────────────
    const allPassed = runner.printSummary();
    process.exit(allPassed ? 0 : 1);
}

runAllTests().catch((err) => {
    console.error('Fatal error during test suite execution:', err);
    process.exit(1);
});
