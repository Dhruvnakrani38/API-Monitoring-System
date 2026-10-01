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
const TeamPage = lazy(() => import('./pages/TeamPage').then(m => ({ default: m.TeamPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));

const pageFallback = (
    <div style={{ height: '60vh', display: 'grid', placeItems: 'center' }}>Loading…</div>
);

function AuthGate() {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'signup'
    const queryClient = useQueryClient();

    const applyProfile = (response) => {
        if (!response?.success || !response.data || typeof response.data !== 'object') {
            throw new Error('Authentication API did not return a valid profile');
        }
        setCurrentUser(response.data);
        setIsAuthenticated(true);
    };

    useEffect(() => {
        const controller = new AbortController();
        authApi.getProfile({ signal: controller.signal })
            .then(applyProfile)
            .catch((err) => {
                if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
                    setIsAuthenticated(false);
                }
            });
        return () => controller.abort();
    }, []);

    const handleLoginSuccess = async () => {
        try {
            const response = await authApi.getProfile();
            applyProfile(response);
        } catch {
            setIsAuthenticated(false);
        }
    };

    const handleLogout = useCallback(async () => {
        try { await authApi.logout(); } catch { }
        queryClient.clear();
        setCurrentUser(null);
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
        <DashboardLayout onLogout={handleLogout} currentUser={currentUser}>
            <Suspense fallback={pageFallback}>
                <Routes>
                    <Route path="/" element={<OverviewPage currentUser={currentUser} />} />
                    <Route path="/approvals" element={currentUser?.role === 'super_admin' ? <PendingApprovalsPage /> : <Navigate to="/" replace />} />
                    <Route path="/team" element={currentUser?.role === 'client_admin' ? <TeamPage currentUser={currentUser} /> : <Navigate to="/" replace />} />
                    <Route path="/alerts" element={<AlertsPage currentUser={currentUser} />} />
                    <Route path="/settings" element={<SettingsPage currentUser={currentUser} />} />
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
