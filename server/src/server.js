import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './shared/config/index.js';
import logger from './shared/config/logger.js';
import mongodb from './shared/config/mongodb.js';
import postgres from './shared/config/postgres.js';
import rabbitmq from './shared/config/rabbitmq.js';
import errorHandler from './shared/middlewares/errorHandler.js';
import ResponseFormatter from './shared/utils/responseFormatter.js';
import cookieParser from "cookie-parser";

// Routers - Pure system routing modules
import authRouter from "./services/auth/routes/authRouter.js";
import clientRouter from './services/client/routes/clientRoutes.js';
import ingestRouter from "./services/ingest/routes/ingestRoutes.js";
import analyticsRouter from "./services/analytics/routes/analyticsRoutes.js";
import alertRouter from './services/alerts/routes/alertRoutes.js';
import alertsContainer from './services/alerts/Dependencies/dependencies.js';
import syntheticRouter from './services/synthetics/routes/syntheticRoutes.js';
import syntheticsContainer from './services/synthetics/Dependencies/dependencies.js';
import { startConsumerWithRetry } from './services/processor/consumer.js';

/**
 * 🟢 Express Application Initialization
 * Kaam: Main Express web server app instance create karta hai.
 * Usage: Express routes, middlewares, aur handlers ko register karne ke liye use hota hai.
 */
const app = express();

/**
 * 🛡️ Security & Core Middlewares Configuration
 * Kaam: Security headers, CORS origins, Cookie parsing, aur Body payload reading enable karta hai.
 * Reusable: Standard Express setup - kisi bhi project me security & CORS ke liye reusable hai.
 */
app.use(helmet()); // HTTP Security Headers add karta hai (XSS, Clickjacking se protection)
app.use(cors({
    origin: (origin, callback) => callback(null, !origin || config.corsOrigins.includes(origin)),
    credentials: true // Cookies aur auth headers accept karne ke liye
}));
app.use(cookieParser()); // Auth tokens/cookies parse karta hai
app.use(express.json()); // JSON payload read karne ke liye
app.use(express.urlencoded({ extended: true })); // URL encoded forms parse karne ke liye

/**
 * 📝 Request Logging Middleware
 * Kaam: Har aane wali HTTP request ka Method, Path, IP address aur User-Agent log karta hai.
 * Reusable: Standard audit logging middleware ke roop me reusable hai.
 */
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
    next();
});

/**
 * 🏥 Health Check Endpoint
 * URL: GET /health
 * Kaam: Server, Uptime aur System health status return karta hai.
 * Usage: Load balancers (e.g. Render, AWS, Docker) dwara application uptime monitoring ke liye use hota hai.
 */
app.get('/health', (req, res) => {
    res.status(200).json(
        ResponseFormatter.success(
            {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            },
            'Service is healthy'
        )
    );
});

/**
 * 🌐 Root Service Endpoint
 * URL: GET /
 * Kaam: API service ka name, version aur primary endpoints info provide karta hai.
 */
app.get("/", (req, res) => {
    res.status(200).json(
        ResponseFormatter.success(
            {
                service: 'API Hit Monitoring System',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    auth: '/api/auth',
                    ingest: '/api/hit',
                    analytics: '/api/analytics',
                },
            },
            'API Hit Monitoring Service'
        )
    );
});

/**
 * 🚦 System API Route Registrations
 * Kaam: Feature modules ko respective API endpoint paths par mount karta hai.
 * - /api/auth: Signup, Login, Profile, Admin User Approvals
 * - /api/hit: Ingesting API Monitoring Hit Events into RabbitMQ
 * - /api/analytics: Analytics Queries, Charts, Dashboard Metrics
 * - /api: Client Onboarding & API Key Management
 */
app.use("/api/auth", authRouter);
app.use("/api/hit", ingestRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/alerts", alertRouter);
app.use("/api/synthetics", syntheticRouter);
app.use("/api", clientRouter);

/**
 * 🚫 404 Route Not Found Handler
 * Kaam: Agar request kisi unknown path par aaye to Standard JSON 404 error return karta hai.
 */
app.use((req, res) => {
    res.status(404).json(ResponseFormatter.error("Endpoint not found", 404));
});

/**
 * ⚠️ Centralized Global Error Handler Middleware
 * Kaam: Pure server ke uncaught errors ko catch karke uniform error response format me client ko bhejta hai.
 */
app.use(errorHandler);

/**
 * 🔌 Database Connections Initializer Function
 * Kaam: MongoDB (Analytics), PostgreSQL (Users & Clients), aur RabbitMQ (Queue Broker) ko initialize aur test karta hai.
 * Reusable: Multi-database bootstrap process me reusable structure.
 */
async function initializeConnection() {
    try {
        logger.info("Initializing database connections...");

        // 1. Connect to MongoDB Atlas / Local MongoDB
        await mongodb.connect();

        // 2. Test PostgreSQL Database Pool Connection
        await postgres.testConnection();

        // 2b. Ensure durable alert and incident tables exist before serving requests.
        await alertsContainer.repositories.alertRepository.ensureSchema();
        await syntheticsContainer.repositories.syntheticRepository.ensureSchema();

        // 3. Connect to RabbitMQ Queue Broker & Assert Queues
        try {
            await rabbitmq.connect();
            logger.info("RabbitMQ connected successfully");
        } catch (error) {
            logger.warn("RabbitMQ unavailable; continuing without queue processing for local development.", error.message || error);
        }

        logger.info("All required connections initialized successfully");
    } catch (error) {
        logger.error("Failed to initialize primary connections:", error);
        throw error;
    }
}

/**
 * 🚀 Server Bootstrap & Graceful Shutdown Handler
 * Kaam: Complete application ko start karta hai aur termination signals (SIGINT, SIGTERM) aane par saare DB connections safe tarike se close karta hai.
 */
async function startServer() {
    try {
        await initializeConnection();

        const server = app.listen(config.port, () => {
            logger.info(`Server started on port ${config.port}`);
            logger.info(`Environment: ${config.node_env}`);
            logger.info(`API available at: http://localhost:${config.port}`);

            // Start background Consumer worker (queue processor, alerts & synthetics evaluator)
            startConsumerWithRetry().catch((err) => {
                logger.error('Background consumer failed to start:', err);
            });
        });

        // Safe Shutdown Function - Data loss avoid karne ke liye connections properly close karta hai
        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} received, shutting down gracefully...`);

            server.close(async () => {
                logger.info("HTTP server closed");

                try {
                    await mongodb.disconnect();
                    await postgres.close();
                    await rabbitmq.close();
                    logger.info('All connections closed, exiting process');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });

            // Fallback timeout - Max 10s me force close karega
            setTimeout(() => {
                logger.error("Forced shutdown");
                process.exit(1);
            }, 10000);
        };

        // Operating System termination signals catch karna
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));

        // Uncaught exceptions & promise rejections safety handlers
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Execute Server Launch
startServer();