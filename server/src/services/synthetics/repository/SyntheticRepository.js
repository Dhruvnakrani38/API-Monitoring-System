export class SyntheticRepository {
    constructor({ postgres }) { this.postgres = postgres; }

    async ensureSchema() {
        await this.postgres.query(`
            CREATE TABLE IF NOT EXISTS synthetic_checks (
                id BIGSERIAL PRIMARY KEY,
                client_id VARCHAR(24) NOT NULL,
                name VARCHAR(160) NOT NULL,
                url VARCHAR(2000) NOT NULL,
                method VARCHAR(10) NOT NULL DEFAULT 'GET',
                expected_status INTEGER NOT NULL DEFAULT 200,
                timeout_ms INTEGER NOT NULL DEFAULT 10000,
                interval_seconds INTEGER NOT NULL DEFAULT 60,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                headers JSONB DEFAULT '{}'::jsonb,
                body TEXT DEFAULT '',
                assertions JSONB DEFAULT '[]'::jsonb,
                max_latency_ms INTEGER,
                failure_threshold INTEGER DEFAULT 3,
                consecutive_failures INTEGER DEFAULT 0,
                consecutive_successes INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'healthy',
                created_by VARCHAR(64),
                last_run_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_synthetic_checks_client ON synthetic_checks(client_id, enabled);

            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';
            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS assertions JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS max_latency_ms INTEGER;
            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS failure_threshold INTEGER DEFAULT 3;
            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;
            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS consecutive_successes INTEGER DEFAULT 0;
            ALTER TABLE synthetic_checks ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'healthy';

            CREATE TABLE IF NOT EXISTS synthetic_check_runs (
                id BIGSERIAL PRIMARY KEY,
                check_id BIGINT NOT NULL REFERENCES synthetic_checks(id) ON DELETE CASCADE,
                success BOOLEAN NOT NULL,
                status_code INTEGER,
                latency_ms NUMERIC(12, 3),
                error_message TEXT,
                assertion_results JSONB DEFAULT '[]'::jsonb,
                passed_assertions INTEGER DEFAULT 0,
                total_assertions INTEGER DEFAULT 0,
                checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_synthetic_runs_check_time ON synthetic_check_runs(check_id, checked_at DESC);

            ALTER TABLE synthetic_check_runs ADD COLUMN IF NOT EXISTS assertion_results JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE synthetic_check_runs ADD COLUMN IF NOT EXISTS passed_assertions INTEGER DEFAULT 0;
            ALTER TABLE synthetic_check_runs ADD COLUMN IF NOT EXISTS total_assertions INTEGER DEFAULT 0;
        `);
    }

    async list(clientId = null) {
        const values = clientId ? [clientId] : [];
        const where = clientId ? 'WHERE client_id = $1' : '';
        return (await this.postgres.query({ text: `SELECT * FROM synthetic_checks ${where} ORDER BY created_at DESC`, values })).rows;
    }

    async due() {
        return (await this.postgres.query(`SELECT * FROM synthetic_checks WHERE enabled = TRUE AND (last_run_at IS NULL OR last_run_at + (interval_seconds * INTERVAL '1 second') <= CURRENT_TIMESTAMP) ORDER BY last_run_at NULLS FIRST LIMIT 100`)).rows;
    }

    async create(check) {
        return (await this.postgres.query({
            text: `INSERT INTO synthetic_checks 
                (client_id, name, url, method, expected_status, timeout_ms, interval_seconds, headers, body, assertions, max_latency_ms, failure_threshold, created_by) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            values: [
                check.clientId,
                check.name,
                check.url,
                check.method,
                check.expectedStatus,
                check.timeoutMs,
                check.intervalSeconds,
                JSON.stringify(check.headers || {}),
                check.body || '',
                JSON.stringify(check.assertions || []),
                check.maxLatencyMs || null,
                check.failureThreshold || 3,
                check.createdBy,
            ],
        })).rows[0];
    }

    async remove(id, clientId = null) {
        const values = [id];
        let query = 'DELETE FROM synthetic_checks WHERE id = $1';
        if (clientId) {
            query += ' AND client_id = $2';
            values.push(clientId);
        }
        query += ' RETURNING id';
        const result = await this.postgres.query({ text: query, values });
        return Boolean(result.rows[0]);
    }

    async recordRun(id, result, check) {
        await this.postgres.query({
            text: `INSERT INTO synthetic_check_runs (check_id, success, status_code, latency_ms, error_message, assertion_results, passed_assertions, total_assertions) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            values: [
                id,
                result.success,
                result.statusCode,
                result.latencyMs,
                result.errorMessage,
                JSON.stringify(result.assertionResults || []),
                result.passedAssertions || 0,
                result.totalAssertions || 0,
            ],
        });

        // Update consecutive failure/success tracking & status logic
        let consecutiveFailures = Number(check.consecutive_failures || 0);
        let consecutiveSuccesses = Number(check.consecutive_successes || 0);
        const threshold = Number(check.failure_threshold || 3);

        if (result.success) {
            consecutiveSuccesses += 1;
            consecutiveFailures = 0;
        } else {
            consecutiveFailures += 1;
            consecutiveSuccesses = 0;
        }

        let newStatus = 'healthy';
        if (consecutiveFailures >= threshold) {
            newStatus = 'failing';
        } else if (consecutiveFailures > 0) {
            newStatus = 'degraded';
        }

        return (await this.postgres.query({
            text: `UPDATE synthetic_checks SET 
                  last_run_at = CURRENT_TIMESTAMP, 
                  updated_at = CURRENT_TIMESTAMP,
                  consecutive_failures = $2,
                  consecutive_successes = $3,
                  status = $4
                  WHERE id = $1 RETURNING *`,
            values: [id, consecutiveFailures, consecutiveSuccesses, newStatus],
        })).rows[0];
    }

    async runs(id, clientId = null) {
        const values = [id];
        let query = `SELECT r.* FROM synthetic_check_runs r JOIN synthetic_checks c ON c.id = r.check_id WHERE r.check_id = $1`;
        if (clientId) {
            query += ` AND c.client_id = $2`;
            values.push(clientId);
        }
        query += ` ORDER BY r.checked_at DESC LIMIT 50`;
        return (await this.postgres.query({ text: query, values })).rows;
    }
}