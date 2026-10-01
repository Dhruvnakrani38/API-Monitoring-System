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
                created_by VARCHAR(64),
                last_run_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_synthetic_checks_client ON synthetic_checks(client_id, enabled);
            CREATE TABLE IF NOT EXISTS synthetic_check_runs (
                id BIGSERIAL PRIMARY KEY,
                check_id BIGINT NOT NULL REFERENCES synthetic_checks(id) ON DELETE CASCADE,
                success BOOLEAN NOT NULL,
                status_code INTEGER,
                latency_ms NUMERIC(12, 3),
                error_message TEXT,
                checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_synthetic_runs_check_time ON synthetic_check_runs(check_id, checked_at DESC);
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
            text: `INSERT INTO synthetic_checks (client_id,name,url,method,expected_status,timeout_ms,interval_seconds,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            values: [check.clientId, check.name, check.url, check.method, check.expectedStatus, check.timeoutMs, check.intervalSeconds, check.createdBy],
        })).rows[0];
    }

    async remove(id, clientId) {
        const result = await this.postgres.query({ text: 'DELETE FROM synthetic_checks WHERE id = $1 AND client_id = $2 RETURNING id', values: [id, clientId] });
        return Boolean(result.rows[0]);
    }

    async recordRun(id, result) {
        await this.postgres.query({ text: `INSERT INTO synthetic_check_runs (check_id,success,status_code,latency_ms,error_message) VALUES ($1,$2,$3,$4,$5)`, values: [id, result.success, result.statusCode, result.latencyMs, result.errorMessage] });
        return (await this.postgres.query({ text: 'UPDATE synthetic_checks SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', values: [id] })).rows[0];
    }

    async runs(id, clientId) {
        return (await this.postgres.query({ text: `SELECT r.* FROM synthetic_check_runs r JOIN synthetic_checks c ON c.id = r.check_id WHERE r.check_id = $1 AND c.client_id = $2 ORDER BY r.checked_at DESC LIMIT 50`, values: [id, clientId] })).rows;
    }
}