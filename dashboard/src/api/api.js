import axios from 'axios';

/**
 * 🌐 Global Frontend API Base URL Configuration
 * Kaam: Environment variable (`VITE_API_BASE_URL`) ya relative `/api` path pick karta hai.
 * Usage: Vercel rewrite proxy ya custom backend URL set karne ke liye.
 */
const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL ?? '/api';

/**
 * ⚡ Axios Shared Instance
 * Kaam: Cross-origin HTTP requests me Credentials (Cookies) send karne ke liye setup.
 * Reusable: App me saare API calls isi `api` instance ke through hoti hain.
 */
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

/**
 * 🚨 Axios Response Interceptor (Auth Token Expiry Handler)
 * Kaam: Agar API response 401 Unauthorized return kare, to global `auth:unauthorized` event dispatch karke client ko automatically login screen par bhejta hai.
 */
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthRoute = error.config?.url?.includes('/auth/');
        if (error.response?.status === 401 && !isAuthRoute) {
            window.dispatchEvent(new Event('auth:unauthorized'));
        }
        return Promise.reject(error);
    }
);

/**
 * 🔐 Authentication & Admin Approval API Helper Object
 * Kaam: Login, Signup, Profile, Pending Approvals, aur User Approve/Reject endpoints calls.
 * Reusable: React Query / Components (Login.jsx, Signup.jsx, PendingApprovalsPage.jsx) me reusable.
 */
export const authApi = {
    login: async (credentials) => {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    },
    signup: async (userData) => {
        const response = await api.post('/auth/signup', userData);
        return response.data;
    },
    register: async (userData) => {
        const response = await api.post('/auth/register', userData);
        return response.data;
    },
    getProfile: async (options) => {
        const response = await api.get('/auth/profile', { signal: options?.signal });
        return response.data;
    },
    logout: async () => {
        const response = await api.post('/auth/logout');
        return response.data;
    },
    updateProfile: async (profileData) => {
        const response = await api.put('/auth/profile', profileData);
        return response.data;
    },
    // Admin Pending Approvals APIs
    getPendingUsers: async () => {
        const response = await api.get('/auth/admin/pending-users');
        return response.data;
    },
    approveUser: async (userId) => {
        const response = await api.post(`/auth/admin/users/${userId}/approve`);
        return response.data;
    },
    rejectUser: async (userId) => {
        const response = await api.post(`/auth/admin/users/${userId}/reject`);
        return response.data;
    },
};

export const analyticsApi = {
    getDashboard: async () => {
        const response = await api.get('/analytics/dashboard');
        const payload = response.data || {};

        payload.data = payload.data || {};

        payload.data.stats = payload.data.stats ?? {
            totalHits: 0,
            avgLatency: 0,
            errorRate: 0,
            errorHits: 0,
            successHits: 0,
            uniqueServices: 0,
            uniqueEndpoints: 0,
        };

        payload.data.topEndpoints = payload.data.topEndpoints ?? [];
        payload.data.recentActivity = payload.data.recentActitivy ?? payload.data.recentActivity ?? [];

        return payload;
    },
    getStats: async (params) => {
        const response = await api.get('/analytics/stats', { params });
        return response.data;
    },
    getTopEndpoints: async (params) => {
        const response = await api.get('/analytics/top-endpoints', { params });
        return response.data;
    },
    getTimeSeries: async (params) => {
        const response = await api.get('/analytics/time-series', { params });
        return response.data;
    },
};

export const clientApi = {
    getCurrentClient: async () => {
        const response = await api.get('/clients/current');
        return response.data;
    },
    getClientDashboard: async (clientId) => {
        const params = clientId ? { clientId } : {};
        const response = await api.get('/clients/dashboard', { params });
        return response.data;
    },
    createClient: async (clientData) => {
        const response = await api.post('/admin/clients', clientData);
        return response.data;
    },
    getClients: async (params) => {
        const response = await api.get('/admin/clients', { params });
        return response.data;
    },
    createApiKey: async (clientId, keyData) => {
        const response = await api.post(`/admin/clients/${clientId}/api-keys`, keyData);
        return response.data;
    },
    getClientApiKeys: async (clientId) => {
        const response = await api.get(`/admin/clients/${clientId}/api-keys`);
        return response.data;
    },
};

export default api;
