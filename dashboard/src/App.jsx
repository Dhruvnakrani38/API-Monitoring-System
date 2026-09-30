import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Login from './components/Login';
import Signup from './components/Signup';
import LandingPage from './components/LandingPage';
import { authApi } from './api/api';
import { DashboardLayout } from './components/layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';

const OverviewPage = lazy(() => import('./pages/OverviewPage').then(m => ({ default: m.OverviewPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PendingApprovalsPage = lazy(() => import('./pages/PendingApprovalsPage').then(m => ({ default: m.PendingApprovalsPage })));

const pageFallback = (
    <div style={{ height: '60vh', display: 'grid', placeItems: 'center' }}>Loading…</div>
);

function AuthGate() {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'signup'
    const queryClient = useQueryClient();

    useEffect(() => {
        const controller = new AbortController();
        authApi.getProfile({ signal: controller.signal })
            .then(() => setIsAuthenticated(true))
            .catch((err) => {
                if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
                    setIsAuthenticated(false);
                }
            });
        return () => controller.abort();
    }, []);

    const handleLoginSuccess = () => setIsAuthenticated(true);

    const handleLogout = useCallback(async () => {
        try { await authApi.logout(); } catch { }
        queryClient.clear();
        setAuthView('landing');
        setIsAuthenticated(false);
    }, [queryClient]);

    useEffect(() => {
        if (isAuthenticated !== true) return;
        const handle401 = () => {
            queryClient.clear();
            setAuthView('landing');
            setIsAuthenticated(false);
        };
        window.addEventListener('auth:unauthorized', handle401);
        return () => window.removeEventListener('auth:unauthorized', handle401);
    }, [isAuthenticated, queryClient]);

    if (isAuthenticated === null) {
        return (
            <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
                Checking authentication…
            </div>
        );
    }

    if (!isAuthenticated) {
        if (authView === 'landing') {
            return (
                <LandingPage
                    onLogin={() => setAuthView('login')}
                    onSignup={() => setAuthView('signup')}
                />
            );
        }

        if (authView === 'signup') {
            return (
                <Signup
                    onSignupSuccess={() => setAuthView('login')}
                    onToggleLogin={() => setAuthView('login')}
                    onBack={() => setAuthView('landing')}
                />
            );
        }
        return (
            <Login
                onLoginSuccess={handleLoginSuccess}
                onToggleSignup={() => setAuthView('signup')}
                onBack={() => setAuthView('landing')}
            />
        );
    }

    return (
        <DashboardLayout onLogout={handleLogout}>
            <Suspense fallback={pageFallback}>
                <Routes>
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/approvals" element={<PendingApprovalsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </DashboardLayout>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <ToastProvider>
                    <BrowserRouter>
                        <AuthGate />
                    </BrowserRouter>
                </ToastProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}

export default App;
