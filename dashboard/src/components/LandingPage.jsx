import { useState } from 'react';
import { Activity, Check, Code2, Copy, LogIn, ShieldCheck, UserRoundPlus } from 'lucide-react';
import styles from '../styles/modules/LandingPage.module.scss';

const signalBars = [28, 42, 34, 58, 45, 72, 49, 64, 38, 82, 54, 69, 44, 90, 57, 73, 48, 62, 39, 77, 52, 68, 43, 84];
const middlewareSnippet = `export function pulseWatchMiddleware({ serviceName = process.env.PULSEWATCH_SERVICE_NAME || 'my-api' } = {}) {
    return (req, res, next) => {
        if (req.path === '/api/hit' || req.method === 'OPTIONS') return next();

        const startedAt = performance.now();
        res.once('finish', () => {
            const endpoint = req.route?.path
                ? req.baseUrl + req.route.path
                : req.path;

            void fetch((process.env.PULSEWATCH_URL || 'http://localhost:5000') + '/api/hit', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': process.env.PULSEWATCH_API_KEY,
                },
                body: JSON.stringify({
                    serviceName,
                    endpoint,
                    method: req.method,
                    statusCode: res.statusCode,
                    latencyMs: performance.now() - startedAt,
                }),
            }).catch((error) => console.error('PulseWatch ingest failed:', error.message));
        });

        next();
    };
}

// Register before your route handlers.
app.use(pulseWatchMiddleware());`;

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
                <a className={styles.brand} href="/" aria-label="PulseWatch home">
                    <span className={styles.brandMark}><Activity aria-hidden="true" /></span>
                    <span>PulseWatch</span>
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
                        <p>Add this middleware after creating a PulseWatch client and API key.</p>
                    </div>
                    <button className={styles.copyButton} type="button" onClick={copyMiddleware}>
                        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copied ? 'Copied' : 'Copy middleware'}
                    </button>
                </div>
                <div className={styles.codeFrame}>
                    <div className={styles.codeLabel}><Code2 aria-hidden="true" /> pulsewatch-middleware.js</div>
                    <pre><code>{middlewareSnippet}</code></pre>
                </div>
                <div className={styles.guideDetails}>
                    <div className={styles.guideColumn}>
                        <h3>Setup in order</h3>
                        <ol>
                            <li>Ask your PulseWatch admin for an active API key for your client.</li>
                            <li>Set <code>PULSEWATCH_API_KEY</code> and <code>PULSEWATCH_URL</code> in your server environment. The URL is the PulseWatch API origin, such as <code>http://localhost:5000</code> locally.</li>
                            <li>Save the snippet as <code>pulsewatch-middleware.js</code>. It uses Node.js 18+ built-in <code>fetch</code>.</li>
                            <li>Import it and register <code>app.use(pulseWatchMiddleware())</code> before your Express route handlers.</li>
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
                    Before production: set a unique high-entropy <code>JWT_SECRET</code>, serve PulseWatch over HTTPS, and replace the current permissive CORS origin setting with an allow-list for your dashboard. Never put the API key in browser code or a public repository.
                </p>
                <p className={styles.integrationHint}>
                    Keep <code>PULSEWATCH_API_KEY</code> on your server. Set <code>PULSEWATCH_URL</code> to the deployed PulseWatch API origin outside local development.
                </p>
            </section>

            <footer className={styles.footer}>
                <span>PulseWatch</span>
                <span>API Monitoring System</span>
            </footer>
        </main>
    );
}

export default LandingPage;