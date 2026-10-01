import { useState } from 'react';
import { Activity, Check, Code2, Copy, LogIn, ShieldCheck, UserRoundPlus } from 'lucide-react';
import styles from '../styles/modules/LandingPage.module.scss';

const signalBars = [28, 42, 34, 58, 45, 72, 49, 64, 38, 82, 54, 69, 44, 90, 57, 73, 48, 62, 39, 77, 52, 68, 43, 84];
const middlewareSnippet = `// monitoring.js
const axios = require('axios');

function monitoringMiddleware(options = {}) {
    const {
        apiKey = process.env.PULSEWATCH_API_KEY,
        url = process.env.PULSEWATCH_URL || 'http://localhost:5000',
        endpoint: configuredEndpoint = process.env.MONITORING_ENDPOINT,
        serviceName = process.env.PULSEWATCH_SERVICE_NAME || 'my-api',
        timeout = Number(process.env.PULSEWATCH_TIMEOUT_MS || 15000),
        enabled = process.env.MONITORING_ENABLED !== 'false',
        enableLogging = process.env.MONITORING_LOGGING === 'true',
        ignore = [],
    } = options;
    const endpoint = configuredEndpoint || (url.replace(/\\/+$/, '') + '/api/hit');

    if (!enabled || !apiKey) return (req, res, next) => next();

    return (req, res, next) => {
        if (ignore.includes(req.path)) return next();

        const startedAt = Date.now();
        const originalEnd = res.end;

        res.end = function (...args) {
            const data = {
                serviceName,
                endpoint: req.path,
                method: req.method,
                statusCode: res.statusCode,
                latencyMs: Date.now() - startedAt,
                ip: req.ip || req.socket?.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
            };

            setImmediate(() => axios.post(endpoint, data, {
                headers: { 'x-api-key': apiKey },
                timeout,
            }).catch((error) => {
                if (enableLogging) console.error('PlusWatch monitoring failed:', error.message);
            }));

            return originalEnd.apply(res, args);
        };

        next();
    };
}

module.exports = monitoringMiddleware;

// server.js
const express = require('express');
const monitoringMiddleware = require('./monitoring');
const app = express();

app.use(express.json());
// Configure this only when your deployment uses a known proxy.
// app.set('trust proxy', 1);
app.use(monitoringMiddleware({ ignore: ['/api/health', '/api/hit'] }));
app.get('/api/health', (req, res) => res.json({ ok: true }));`;

// Ye public entry screen ko login aur signup ke existing views se jodta hai.
function LandingPage({ onLogin, onSignup }) {
        const [copied, setCopied] = useState(false);

        const copyMiddleware = async () => {
                await navigator.clipboard.writeText(middlewareSnippet);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
        };

    return (
        <main className={styles.page}>
            <div className={styles.grid} aria-hidden="true" />
            <header className={styles.header}>
                <a className={styles.brand} href="/" aria-label="PlusWatch home">
                    <span className={styles.brandMark}><Activity aria-hidden="true" /></span>
                    <span className={styles.brandCopy}>
                        <strong>PlusWatch</strong>
                        <small>by DN Systems</small>
                    </span>
                </a>
                <span className={styles.headerLabel}>
                    <span className={styles.statusDot} /> API OBSERVABILITY
                </span>
            </header>

            <section className={styles.hero} aria-labelledby="landing-title">
                <p className={styles.eyebrow}>SEE THE SIGNAL IN EVERY REQUEST</p>
                <h1 id="landing-title">Keep your APIs<br /><span>in view.</span></h1>
                <p className={styles.description}>
                    A clear place to follow API traffic, response times, and errors.
                </p>
                <div className={styles.actions}>
                    <button className={styles.primaryAction} type="button" onClick={onLogin}>
                        <LogIn aria-hidden="true" />
                        Login
                    </button>
                    <button className={styles.secondaryAction} type="button" onClick={onSignup}>
                        <UserRoundPlus aria-hidden="true" />
                        Sign up
                    </button>
                </div>
                <p className={styles.approvalNote}>
                    <ShieldCheck aria-hidden="true" /> New accounts are enabled after admin approval.
                </p>
            </section>

            <section className={styles.signalSection} aria-label="API monitoring overview">
                <div className={styles.signalHeading}>
                    <span><Activity aria-hidden="true" /> REQUEST SIGNAL</span>
                    <span>TRAFFIC / LATENCY / ERRORS</span>
                </div>
                <div className={styles.signalBars} aria-hidden="true">
                    {signalBars.map((height, index) => (
                        <span
                            key={index}
                            className={styles.signalBar}
                            style={{ '--bar-height': `${height}%` }}
                        />
                    ))}
                </div>
                <div className={styles.signalLabels}>
                    <span>Collect</span>
                    <span>Understand</span>
                    <span>Respond</span>
                </div>
            </section>

            <section className={styles.integrationSection} aria-labelledby="integration-title">
                <div className={styles.integrationHeading}>
                    <div>
                        <p className={styles.eyebrow}>CONNECT YOUR SERVER</p>
                        <h2 id="integration-title">Instrument an Express API</h2>
                        <p>Create this server-side middleware after your PlusWatch client is approved.</p>
                    </div>
                    <button className={styles.copyButton} type="button" onClick={copyMiddleware}>
                        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copied ? 'Copied' : 'Copy middleware'}
                    </button>
                </div>
                <div className={styles.codeFrame}>
                    <div className={styles.codeLabel}><Code2 aria-hidden="true" /> monitoring.js + server.js</div>
                    <pre><code>{middlewareSnippet}</code></pre>
                </div>
                <div className={styles.guideDetails}>
                    <div className={styles.guideColumn}>
                        <h3>Setup in order</h3>
                        <ol>
                            <li>Register your API client and wait for admin approval. Copy the revealed API key only after approval.</li>
                            <li>Create a server-side <code>.env</code> file and add <code>PULSEWATCH_URL=http://localhost:5000</code>, <code>PULSEWATCH_API_KEY=your_approved_key</code>, and <code>PULSEWATCH_SERVICE_NAME=my-api</code>.</li>
                            <li>Create <code>monitoring.js</code> with the code above and install its dependency with <code>npm install axios</code>.</li>
                            <li>In <code>server.js</code>, call <code>express.json()</code> first and register <code>app.use(monitoringMiddleware())</code> before your route handlers.</li>
                            <li>Keep <code>.env</code> and the API key on the server. Never commit them or place the key in browser code.</li>
                            <li>If your API runs behind a known reverse proxy or load balancer, configure Express <code>trust proxy</code> for that deployment so recorded client IPs are accurate. Do not enable it blindly.</li>
                            <li>Restart your API and send a request. New hits will appear in the client dashboard after processing.</li>
                        </ol>
                    </div>
                    <div className={styles.guideColumn}>
                        <h3>Security provided</h3>
                        <ul>
                            <li>API keys are checked against an active client and must have ingest permission.</li>
                            <li>The server assigns the client identity from the validated key; clients cannot choose another tenant in the hit payload.</li>
                            <li>The ingest endpoint is rate-limited. Configure its window and request limit for your deployment.</li>
                            <li>Helmet adds security-related HTTP headers. Dashboard sessions use signed JWTs in HttpOnly cookies, marked Secure in production.</li>
                            <li>User passwords are validated against strength rules and stored as bcrypt hashes. Dashboard access is role-based and analytics are client-scoped.</li>
                        </ul>
                    </div>
                </div>
                <p className={styles.securityWarning}>
                    Before production: set a unique high-entropy <code>JWT_SECRET</code>, serve PlusWatch over HTTPS, and replace the current permissive CORS origin setting with an allow-list for your dashboard. Never put the API key in browser code or a public repository.
                </p>
                <p className={styles.integrationHint}>
                    Keep <code>PULSEWATCH_API_KEY</code> on your server. Set <code>PULSEWATCH_URL</code> to the deployed PlusWatch API origin outside local development.
                </p>
            </section>

            <footer className={styles.footer}>
                <span>PlusWatch</span>
                <span>by DN Systems</span>
            </footer>
        </main>
    );
}

export default LandingPage;