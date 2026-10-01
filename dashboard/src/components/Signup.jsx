import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/api';
import { Activity, Mail, Lock, User, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import styles from '../styles/modules/Login.module.scss';

function Signup({ onSignupSuccess, onToggleLogin, onBack }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const signupMutation = useMutation({
        mutationFn: authApi.signup,
        onSuccess: (data) => {
            if (data.success) {
                setSuccess(true);
                setError('');
                setTimeout(() => {
                    onSignupSuccess();
                }, 3000);
            } else {
                setError(data.message);
            }
        },
        onError: (error) => {
            setError(error.response?.data?.message || 'Failed to connect to server');
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        signupMutation.mutate({ username, email, password });
    };

    if (success) {
        return (
            <div className={styles.container}>
                <div className={styles.backgroundElements}>
                    <div className={`${styles.backgroundOrb} ${styles.orb1}`}></div>
                    <div className={`${styles.backgroundOrb} ${styles.orb2}`}></div>
                    <div className={`${styles.backgroundOrb} ${styles.orb3}`}></div>
                </div>

                <div className={styles.loginCard}>
                    <div className={styles.cardHeader}>
                        <div className={styles.logoContainer}>
                            <CheckCircle className={styles.successIcon} />
                        </div>
                        <h1 className={styles.title}>
                            Account Created!
                        </h1>
                        <p className={styles.description}>
                            Your account has been created successfully. Please wait for admin approval before you can login.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

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
                        <Activity aria-hidden="true" />
                    </div>
                    <h1 className={styles.title}>
                        PlusWatch
                    </h1>
                    <p className={styles.description}>
                        Sign up for API monitoring services
                    </p>
                </div>
                <div className={styles.cardContent}>
                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="username" className={styles.label}>
                                Username
                            </label>
                            <div className={styles.inputContainer}>
                                <User />
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    disabled={signupMutation.isPending}
                                    className={styles.input}
                                    placeholder="Choose a username"
                                    minLength={3}
                                />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>
                                Email
                            </label>
                            <div className={styles.inputContainer}>
                                <Mail />
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={signupMutation.isPending}
                                    className={styles.input}
                                    placeholder="Enter your email"
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
                                    disabled={signupMutation.isPending}
                                    className={styles.input}
                                    placeholder="Create a password"
                                    minLength={6}
                                />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label htmlFor="confirmPassword" className={styles.label}>
                                Confirm Password
                            </label>
                            <div className={styles.inputContainer}>
                                <Lock />
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={signupMutation.isPending}
                                    className={styles.input}
                                    placeholder="Confirm your password"
                                    minLength={6}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={signupMutation.isPending}
                        >
                            <div className={styles.buttonContent}>
                                {signupMutation.isPending ? (
                                    <>
                                        <Loader2 className="animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Sign Up'
                                )}
                            </div>
                        </button>
                    </form>
                    <div className={styles.switchAuth}>
                        <p>
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={onToggleLogin || (() => window.location.href = '/login')}
                                className={styles.switchButton}
                            >
                                Sign In
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Signup;