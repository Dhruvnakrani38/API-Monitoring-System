import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/api';
import { Activity, ArrowLeft, Lock, User, Loader2 } from 'lucide-react';
import styles from '../styles/modules/Login.module.scss';

// The backend base URL for OAuth redirect (server URL, not Vite dev server)
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL?.startsWith('http')
    ? new URL(import.meta.env.VITE_API_BASE_URL).origin
    : (typeof window !== 'undefined' ? window.location.origin : '');

function Login({ onLoginSuccess, onToggleSignup, onBack }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [googlePending, setGooglePending] = useState(false);
    const [googlePendingEmail, setGooglePendingEmail] = useState('');

    // Check URL params on mount for OAuth redirect results
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('google_auth') === 'success') {
            // Cookie was set by server — trigger profile fetch
            onLoginSuccess();
        } else if (params.get('google_pending')) {
            setGooglePending(true);
            setGooglePendingEmail(params.get('email') || '');
        } else if (params.get('google_error')) {
            setError(`Google sign-in failed: ${decodeURIComponent(params.get('google_error') || 'Unknown error')}`);
        }
        // Clean URL query string
        if (params.toString()) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [onLoginSuccess]);

    const loginMutation = useMutation({
        mutationFn: authApi.login,
        onSuccess: (data) => {
            if (data.success) {
                onLoginSuccess();
            } else {
                setError(data.message);
            }
        },
        onError: (error) => {
            const data = error.response?.data;
            if (data?.error && Array.isArray(data.error) && data.error.length > 0) {
                setError(data.error.join('. '));
            } else if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                setError(data.errors.join('. '));
            } else {
                setError(data?.message || 'Failed to connect to server');
            }
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        loginMutation.mutate({ username, password });
    };

    const handleGoogleSignIn = () => {
        // Redirect to backend Google OAuth initiation route
        window.location.href = `${API_ORIGIN}/api/auth/google`;
    };

    return (
        <div className={styles.container}>
            {/* Animated background elements */}
            <div className={styles.backgroundElements}>
                <div className={`${styles.backgroundOrb} ${styles.orb1}`}></div>
                <div className={`${styles.backgroundOrb} ${styles.orb2}`}></div>
                <div className={`${styles.backgroundOrb} ${styles.orb3}`}></div>
            </div>

            <div className={styles.loginCard}>
                <button type="button" className={styles.backButton} onClick={onBack}>
                    <ArrowLeft aria-hidden="true" />
                    <span>Back</span>
                </button>
                <div className={styles.cardHeader}>
                    <div className={styles.logoContainer}>
                        <Activity />
                    </div>
                    <h1 className={styles.title}>
                        PulseWatch
                    </h1>
                    <p className={styles.description}>
                        Sign in to access your dashboard
                    </p>
                </div>
                <div className={styles.cardContent}>
                    {googlePending && (
                        <div className={styles.pendingMessage}>
                            <span>🕐</span>
                            <div>
                                <strong>Account pending approval</strong>
                                <p>Your Google account ({googlePendingEmail}) was registered. An admin needs to approve it before you can log in.</p>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}

                    {/* Google Sign-In Button */}
                    <button
                        type="button"
                        className={styles.googleButton}
                        onClick={handleGoogleSignIn}
                        id="google-signin-btn"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    </button>

                    <div className={styles.divider}>
                        <span>or sign in with credentials</span>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="username" className={styles.label}>
                                Username or Email
                            </label>
                            <div className={styles.inputContainer}>
                                <User />
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    disabled={loginMutation.isPending}
                                    className={styles.input}
                                    placeholder="Enter your username or email"
                                />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.label}>
                                Password
                            </label>
                            <div className={styles.inputContainer}>
                                <Lock />
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loginMutation.isPending}
                                    className={styles.input}
                                    placeholder="Enter your password"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loginMutation.isPending}
                        >
                            <div className={styles.buttonContent}>
                                {loginMutation.isPending ? (
                                    <>
                                        <Loader2 className="animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </div>
                        </button>
                    </form>

                    {onToggleSignup && (
                        <div className={styles.switchAuth}>
                            Don't have an account?{' '}
                            <button
                                type="button"
                                onClick={onToggleSignup}
                                className={styles.switchButton}
                            >
                                Sign Up
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Login;

