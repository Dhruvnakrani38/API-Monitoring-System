export class AlertRepository {
    constructor({ postgres, logger }) {
        this.postgres = postgres;
        this.logger = logger;
    }

    async ensureSchema() {
        await this.postgres.query(`
            CREATE TABLE IF NOT EXISTS alert_rules (
                id BIGSERIAL PRIMARY KEY,
                client_id VARCHAR(24) NOT NULL,
                name VARCHAR(160) NOT NULL,
                metric VARCHAR(40) NOT NULL CHECK (metric IN ('error_rate', 'error_count', 'avg_latency', 'no_data')),
                operator VARCHAR(4) NOT NULL CHECK (operator IN ('>', '>=', '<', '<=')),
                threshold NUMERIC(14, 4) NOT NULL,
                window_minutes INTEGER NOT NULL DEFAULT 5 CHECK (window_minutes BETWEEN 1 AND 1440),
                service_name VARCHAR(255),
                endpoint VARCHAR(500),
                severity VARCHAR(16) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_by VARCHAR(64),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_alert_rules_client_enabled ON alert_rules(client_id, enabled);

            CREATE TABLE IF NOT EXISTS alert_incidents (
                id BIGSERIAL PRIMARY KEY,
                rule_id BIGINT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
                client_id VARCHAR(24) NOT NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
                value NUMERIC(14, 4),
                message TEXT NOT NULL,
                opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                acknowledged_at TIMESTAMP,
                resolved_at TIMESTAMP,
                last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_alert_incidents_client_status ON alert_incidents(client_id, status, last_seen_at DESC);
        `);
    }

    async listRules(clientId = null) {
        const values = [];
        let query = 'SELECT * FROM alert_rules';
        if (clientId) {
            values.push(clientId);
            query += ' WHERE client_id = $1';
        }
        query += ' ORDER BY created_at DESC';
        return (await this.postgres.query({ text: query, values })).rows;
    }

    async listEnabledRules() {
        return (await this.postgres.query('SELECT * FROM alert_rules WHERE enabled = TRUE ORDER BY id')).rows;
    }

    async findOpenIncident(ruleId) {
        const result = await this.postgres.query({
            text: `SELECT * FROM alert_incidents WHERE rule_id = $1 AND status <> 'resolved' ORDER BY last_seen_at DESC LIMIT 1`,
            values: [ruleId],
        });
        return result.rows[0] || null;
    }

    async openIncident(rule, value, message) {
        const result = await this.postgres.query({
            text: `INSERT INTO alert_incidents (rule_id, client_id, value, message)
                  VALUES ($1, $2, $3, $4) RETURNING *`,
            values: [rule.id, rule.client_id, value, message],
        });
        return result.rows[0];
    }

    async touchIncident(id, value, message) {
        const result = await this.postgres.query({
            text: `UPDATE alert_incidents SET value = $2, message = $3, last_seen_at = CURRENT_TIMESTAMP
                  WHERE id = $1 RETURNING *`,
            values: [id, value, message],
        });
        return result.rows[0];
    }

    async resolveIncident(id) {
        const result = await this.postgres.query({
            text: `UPDATE alert_incidents SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
                  WHERE id = $1 RETURNING *`,
            values: [id],
        });
        return result.rows[0];
    }

    async createRule(rule) {
        const result = await this.postgres.query({
            text: `INSERT INTO alert_rules
                (client_id, name, metric, operator, threshold, window_minutes, service_name, endpoint, severity, enabled, created_by)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            values: [rule.clientId, rule.name, rule.metric, rule.operator, rule.threshold, rule.windowMinutes, rule.serviceName, rule.endpoint, rule.severity, rule.enabled, rule.createdBy],
        });
        return result.rows[0];
    }

    async updateRule(id, clientId, changes) {
        const result = await this.postgres.query({
            text: `UPDATE alert_rules SET
                name = COALESCE($3, name), metric = COALESCE($4, metric), operator = COALESCE($5, operator),
                threshold = COALESCE($6, threshold), window_minutes = COALESCE($7, window_minutes),
                service_name = COALESCE($8, service_name), endpoint = COALESCE($9, endpoint),
                severity = COALESCE($10, severity), enabled = COALESCE($11, enabled), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND client_id = $2 RETURNING *`,
            values: [id, clientId, changes.name, changes.metric, changes.operator, changes.threshold, changes.windowMinutes, changes.serviceName, changes.endpoint, changes.severity, changes.enabled],
        });
        return result.rows[0] || null;
    }

    async deleteRule(id, clientId) {
        const result = await this.postgres.query({
            text: 'DELETE FROM alert_rules WHERE id = $1 AND client_id = $2 RETURNING id',
            values: [id, clientId],
        });
        return Boolean(result.rows[0]);
    }

    async listIncidents(clientId = null, status = null) {
        const values = [];
        const conditions = [];
        if (clientId) {
            values.push(clientId);
            conditions.push(`i.client_id = $${values.length}`);
        }
        if (status) {
            values.push(status);
            conditions.push(`i.status = $${values.length}`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        return (await this.postgres.query({
            text: `SELECT i.*, r.name AS rule_name, r.metric, r.severity
                   FROM alert_incidents i JOIN alert_rules r ON r.id = i.rule_id
                   ${where} ORDER BY i.last_seen_at DESC LIMIT 200`,
            values,
        })).rows;
    }
}