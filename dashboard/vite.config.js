import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    css: {
        modules: {
            localsConvention: 'camelCase',
        },
        preprocessorOptions: {
            scss: {
                api: 'modern',
            }
        }
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_PROXY_TARGET || 'https://api-monitoring-system-production-b5ad.up.railway.app',
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
