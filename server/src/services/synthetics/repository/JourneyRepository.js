/**
 * JourneyRepository — PostgreSQL repository for multi-step synthetic user journeys.
 *
 * A "Journey" is an ordered chain of HTTP steps where:
 *   - Each step can extract values from the previous response (variable extraction).
 *   - Extracted values can be injected into subsequent step URLs, headers, or bodies.
 *   - All steps must pass for the journey to be considered "successful".
 *
 * Tables:
 *   synthetic_journeys        — Journey definition (name, interval, client, status)
 *   synthetic_journey_steps   — Ordered steps for each journey
 *   synthetic_journey_runs    — Historical run results
 */
export class JourneyRepository {
    constructor({ postgres }) {
        this.postgres = postgres;
    }

    async ensureSchema() {
        await this.postgres.query(`
            CREATE TABLE IF NOT EXISTS synthetic_journeys (
                id BIGSERIAL PRIMARY KEY,
                client_id VARCHAR(24) NOT NULL,
                name VARCHAR(200) NOT NULL,
                description TEXT DEFAULT '',
                interval_seconds INTEGER NOT NULL DEFAULT 300 CHECK (interval_seconds BETWEEN 30 AND 86400),
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                status VARCHAR(20) NOT NULL DEFAULT 'healthy',
                consecutive_failures INTEGER NOT NULL DEFAULT 0,
                failure_threshold INTEGER NOT NULL DEFAULT 2,
                last_run_at TIMESTAMP,
                created_by VARCHAR(64),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_journeys_client ON synthetic_journeys(client_id, enabled);

            CREATE TABLE IF NOT EXISTS synthetic_journey_steps (
                id BIGSERIAL PRIMARY KEY,
                journey_id BIGINT NOT NULL REFERENCES synthetic_journeys(id) ON DELETE CASCADE,
                step_order INTEGER NOT NULL,
                name VARCHAR(160) NOT NULL,
                url TEXT NOT NULL,
                method VARCHAR(10) NOT NULL DEFAULT 'GET',
                headers JSONB DEFAULT '{}',
                body TEXT DEFAULT '',
                expected_status INTEGER NOT NULL DEFAULT 200,
                max_latency_ms INTEGER,
                assertions JSONB DEFAULT '[]',
                -- Variable extraction: pull values from response JSON and store for later steps
                -- e.g. [{ "varName": "authToken", "jsonPath": "$.data.token" }]
                extract_variables JSONB DEFAULT '[]',
                timeout_ms INTEGER NOT NULL DEFAULT 10000
            );
            CREATE INDEX IF NOT EXISTS idx_journey_steps_order ON synthetic_journey_steps(journey_id, step_order);

            CREATE TABLE IF NOT EXISTS synthetic_journey_runs (
                id BIGSERIAL PRIMARY KEY,
                journey_id BIGINT NOT NULL REFERENCES synthetic_journeys(id) ON DELETE CASCADE,
                success BOOLEAN NOT NULL,
                total_steps INTEGER NOT NULL DEFAULT 0,
                passed_steps INTEGER NOT NULL DEFAULT 0,
                failed_step_name TEXT,
                error_message TEXT,
                duration_ms NUMERIC(14,3),
                step_results JSONB DEFAULT '[]',
                ran_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_journey_runs_time ON synthetic_journey_runs(journey_id, ran_at DESC);
        `);
    }

    async list(clientId = null) {
        const where = clientId ? 'WHERE j.client_id = $1' : '';
        const values = clientId ? [clientId] : [];
        return (await this.postgres.query({
            text: `
                SELECT j.*,
                    COUNT(s.id) AS step_count,
                    (SELECT ran_at FROM synthetic_journey_runs r WHERE r.journey_id = j.id ORDER BY ran_at DESC LIMIT 1) AS last_run_at
                FROM synthetic_journeys j
                LEFT JOIN synthetic_journey_steps s ON s.journey_id = j.id
                ${where}
                GROUP BY j.id
                ORDER BY j.created_at DESC`,
            values,
        })).rows;
    }

    async findById(id, clientId = null) {
        const values = [id];
        let query = 'SELECT * FROM synthetic_journeys WHERE id = $1';
        if (clientId) { query += ' AND client_id = $2'; values.push(clientId); }
        const journey = (await this.postgres.query({ text: query, values })).rows[0] || null;
        if (!journey) return null;

        const steps = (await this.postgres.query({
            text: 'SELECT * FROM synthetic_journey_steps WHERE journey_id = $1 ORDER BY step_order ASC',
            values: [id],
        })).rows;

        return { ...journey, steps };
    }

    async due() {
        return (await this.postgres.query(`
            SELECT * FROM synthetic_journeys
            WHERE enabled = TRUE
              AND (last_run_at IS NULL OR last_run_at + (interval_seconds * INTERVAL '1 second') <= CURRENT_TIMESTAMP)
            ORDER BY last_run_at NULLS FIRST
            LIMIT 20
        `)).rows;
    }

    async create({ clientId, name, description, intervalSeconds, failureThreshold, steps, createdBy }) {
        const result = await this.postgres.query({
            text: `INSERT INTO synthetic_journeys (client_id, name, description, interval_seconds, failure_threshold, created_by)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            values: [clientId, name, description || '', intervalSeconds || 300, failureThreshold || 2, createdBy],
        });
        const journey = result.rows[0];

        if (steps && steps.length > 0) {
            for (let i = 0; i < steps.length; i++) {
                const s = steps[i];
                await this.postgres.query({
                    text: `INSERT INTO synthetic_journey_steps
                        (journey_id, step_order, name, url, method, headers, body, expected_status, max_latency_ms, assertions, extract_variables, timeout_ms)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                    values: [
                        journey.id, i + 1, s.name, s.url,
                        String(s.method || 'GET').toUpperCase(),
                        JSON.stringify(s.headers || {}),
                        s.body || '',
                        s.expectedStatus || 200,
                        s.maxLatencyMs || null,
                        JSON.stringify(s.assertions || []),
                        JSON.stringify(s.extractVariables || []),
                        s.timeoutMs || 10000,
                    ],
                });
            }
        }

        return this.findById(journey.id);
    }

    async remove(id, clientId = null) {
        const values = [id];
        let query = 'DELETE FROM synthetic_journeys WHERE id = $1';
        if (clientId) { query += ' AND client_id = $2'; values.push(clientId); }
        return Boolean((await this.postgres.query({ text: query + ' RETURNING id', values })).rows[0]);
    }

    async recordRun(journeyId, { success, totalSteps, passedSteps, failedStepName, errorMessage, durationMs, stepResults }) {
        await this.postgres.query({
            text: `INSERT INTO synthetic_journey_runs (journey_id, success, total_steps, passed_steps, failed_step_name, error_message, duration_ms, step_results)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            values: [journeyId, success, totalSteps, passedSteps, failedStepName || null, errorMessage || null, durationMs, JSON.stringify(stepResults)],
        });

        const journey = (await this.postgres.query({ text: 'SELECT * FROM synthetic_journeys WHERE id = $1', values: [journeyId] })).rows[0];
        if (!journey) return;

        let { consecutive_failures: cf } = journey;
        cf = success ? 0 : (Number(cf) + 1);
        const newStatus = cf >= Number(journey.failure_threshold) ? 'failing' : cf > 0 ? 'degraded' : 'healthy';

        await this.postgres.query({
            text: `UPDATE synthetic_journeys SET consecutive_failures = $2, status = $3, last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            values: [journeyId, cf, newStatus],
        });
    }

    async runs(journeyId, clientId = null) {
        const values = [journeyId];
        let query = `SELECT r.* FROM synthetic_journey_runs r
                     JOIN synthetic_journeys j ON j.id = r.journey_id
                     WHERE r.journey_id = $1`;
        if (clientId) { query += ' AND j.client_id = $2'; values.push(clientId); }
        query += ' ORDER BY r.ran_at DESC LIMIT 30';
        return (await this.postgres.query({ text: query, values })).rows;
    }
}
