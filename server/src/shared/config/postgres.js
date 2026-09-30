import pg from "pg";
import config from "./index.js";
import logger from "./logger.js";

const { Pool } = pg;

/**
 * 🐘 PostgreSQL Connection Pool Manager Class (Singleton Pattern)
 * Kaam: Database query execution ke liye PostgreSQL connection pool manage karta hai.
 * Reusable: Project me queries run karne ke liye `import postgres from './shared/config/postgres.js'` karke `await postgres.query(sql, params)` use hota hai.
 */
class PostgresConnection {
    constructor() {
        this.pool = null; // Connection pool instance holder
    }

    /**
     * 🏊‍♂️ Connection Pool Getter
     * Kaam: PostgreSQL Connection Pool check aur create karta hai. Supabase/Neon connection string (`DATABASE_URL`) aur SSL options dynamically apply karta hai.
     */
    getPool() {
        if (!this.pool) {
            const poolOptions = config.postgres.connectionString
                ? {
                    // Cloud DB (Supabase / Neon / Render Postgres) Connection String mode
                    connectionString: config.postgres.connectionString,
                    ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
                    max: 20, // Maximum active clients in pool
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                }
                : {
                    // Local / Custom Host Connection Options mode
                    host: config.postgres.host,
                    port: config.postgres.port,
                    database: config.postgres.database,
                    user: config.postgres.user,
                    password: config.postgres.password,
                    ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                };

            this.pool = new Pool(poolOptions);

            // Error event listener on idle database clients
            this.pool.on("error", err => {
                logger.error("Unexpected error on idle PG client", err);
            });

            logger.info("PG Pool Created");
        }
        return this.pool;
    }

    /**
     * 🧪 Test Connection Method
     * Kaam: Server startup ke waqt test query (`SELECT NOW()`) execute karke Postgres database connectivity verify karta hai.
     */
    async testConnection() {
        try {
            const pool = this.getPool();
            const client = await pool.connect();
            const result = await client.query("SELECT NOW()");
            client.release(); // Client pool ko wapas return karta hai

            logger.info(`PG connected successfully at ${result.rows[0].now}`);
        } catch (error) {
            logger.error("Failed to connect to PG", error);
            throw error;
        }
    }

    /**
     * 🔍 Query Execution Helper Method
     * Kaam: SQL queries ko execute karta hai aur performance execution duration log karta hai.
     * Usage: All Repositories & Services me raw SQL queries run karne ke liye. Example: `await postgres.query('SELECT * FROM users WHERE id = $1', [userId])`
     */
    async query(text, params) {
        const pool = this.getPool();
        const start = Date.now();
        try {
            const result = await pool.query(text, params);
            const duration = Date.now() - start;
            logger.debug('Executed query', { text, duration, rows: result.rowCount });
            return result;
        }
        catch (error) {
            logger.error('Query error:', { text, error: error.message });
            throw error;
        }
    }

    /**
     * 🔌 Connection Pool Close Method
     * Kaam: Server shutdown ke time saare database connections cleanly close karta hai.
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info("PG pool closed!");
        }
    }
}

// Export single singleton instance
export default new PostgresConnection();