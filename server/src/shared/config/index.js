/**
 * ⚙️ Global Centralized Configuration Module
 * Kaam: Pure server ke environment variables (.env) ko single place me parse, structure aur fallbacks ke sath export karta hai.
 * Reusable: Project me kahin bhi `import config from './shared/config/index.js'` karke Database, JWT, Server settings use ki ja sakti hain.
 */

import dotenv from "dotenv";

// .env file load karne ke liye
dotenv.config();

const config = {
    // 🖥️ Server Environment Configuration
    // Kaam: Development vs Production mode aur HTTP port identify karta hai
    node_env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || "5000", 10),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,https://api-monitoring-system-six.vercel.app')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),

    // 🍃 MongoDB Database Settings (Raw API Hit Logs Store karne ke liye)
    // Usage: Mongoose connector (mongodb.js) dwara use hota hai. Atlas cloud URL (`mongodb+srv://`) bhi support karta hai.
    mongo: {
        uri: process.env.MONGO_URI || 'mongodb://localhost:27017/api_monitoring',
        dbName: process.env.MONGO_DB_NAME || 'api_monitoring',
    },

    // 🐘 PostgreSQL Database Settings (Users, Clients, Auth Records Store karne ke liye)
    // Usage: `pg` Pool connector (postgres.js) dwara use hota hai. Supabase/Neon Connection URI aur SSL options supported hain.
    postgres: {
        connectionString: process.env.DATABASE_URL || null,
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432', 10),
        database: process.env.PG_DATABASE || 'api_monitoring',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || 'dhruv@123',
        ssl: process.env.PG_SSL === 'true',
    },

    // 🐰 RabbitMQ Message Queue Settings (Asynchronous API hit ingestion & processing)
    // Usage: Publisher (rabbitmq.js) aur Consumer Worker (consumer.js) dwara hit events queue karne ke liye use hota hai.
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://api_user:dhruv@123@localhost:5672/api_monitoring',
        queue: process.env.RABBITMQ_QUEUE || 'api_hits',
        publisherConfirms: process.env.RABBITMQ_PUBLISHER_CONFIRMS === 'true' || false,
        retryAttempts: parseInt(process.env.RABBITMQ_RETRY_ATTEMPTS || '3', 10),
        retryDelay: parseInt(process.env.RABBITMQ_RETRY_DELAY || '1000', 10),
    },

    // 🔐 JWT (JSON Web Token) Security Credentials
    // Usage: Authentication Middleware aur Login Tokens generate/verify karne ke liye.
    jwt: {
        secret: process.env.JWT_SECRET || "SABKA_VALINTINE_WEEK_KAISE_JA_RAHA_HAI",
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },

    // ⏱️ Express Rate Limiter Configurations
    // Usage: DDoS protection & API abuse prevent karne ke liye (express-rate-limit middleware).
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 Minutes window
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10), // Max 1000 requests per IP
    },

    // 🍪 Secure Auth Cookie Settings
    // Usage: Login sessions cookie-parser se set karne ke liye (httpOnly: XSS protection).
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === "production" ? "none" : "lax"),
        expiresIn: 24 * 60 * 60 * 1000 // 1 Day TTL
    }
};

export default config;