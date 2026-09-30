import { Activity, LogIn, ShieldCheck, UserRoundPlus } from 'lucide-react';
import styles from '../styles/modules/LandingPage.module.scss';

const signalBars = [28, 42, 34, 58, 45, 72, 49, 64, 38, 82, 54, 69, 44, 90, 57, 73, 48, 62, 39, 77, 52, 68, 43, 84];

// Ye public entry screen ko login aur signup ke existing views se jodta hai.
function LandingPage({ onLogin, onSignup }) {
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

            <footer className={styles.footer}>
                <span>PulseWatch</span>
                <span>API Monitoring System</span>
            </footer>
        </main>
    );
}

export default LandingPage;