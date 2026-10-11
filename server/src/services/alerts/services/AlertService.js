const METRICS = new Set(['error_rate', 'error_count', 'avg_latency', 'no_data']);
const OPERATORS = new Set(['>', '>=', '<', '<=']);
const SEVERITIES = new Set(['info', 'warning', 'critical']);

export class AlertService {
    constructor({ repository, notificationDispatcher }) {
        this.repository = repository;
        this.notificationDispatcher = notificationDispatcher;
    }

    validateRule(input, partial = false) {
        const rule = {};
        if (!partial || input.name !== undefined) rule.name = String(input.name || '').trim();
        if (!partial || input.metric !== undefined) rule.metric = input.metric;
        if (!partial || input.operator !== undefined) rule.operator = input.operator;
        if (!partial || input.threshold !== undefined) rule.threshold = Number(input.threshold);
        if (!partial || input.windowMinutes !== undefined) rule.windowMinutes = Number(input.windowMinutes);
        if (input.serviceName !== undefined) rule.serviceName = input.serviceName || null;
        if (input.endpoint !== undefined) rule.endpoint = input.endpoint || null;
        if (input.severity !== undefined) rule.severity = input.severity;
        if (input.enabled !== undefined) rule.enabled = Boolean(input.enabled);
        if (input.slackWebhookUrl !== undefined) rule.slackWebhookUrl = input.slackWebhookUrl ? String(input.slackWebhookUrl).trim() : null;
        if (input.discordWebhookUrl !== undefined) rule.discordWebhookUrl = input.discordWebhookUrl ? String(input.discordWebhookUrl).trim() : null;
        if (input.webhookUrl !== undefined) rule.webhookUrl = input.webhookUrl ? String(input.webhookUrl).trim() : null;

        if (rule.name !== undefined && (!rule.name || rule.name.length > 160)) throw new Error('Alert name is required and must be 160 characters or fewer');
        if (rule.metric !== undefined && !METRICS.has(rule.metric)) throw new Error('Unsupported alert metric');
        if (rule.operator !== undefined && !OPERATORS.has(rule.operator)) throw new Error('Unsupported alert operator');
        if (rule.threshold !== undefined && !Number.isFinite(rule.threshold)) throw new Error('Alert threshold must be numeric');
        if (rule.windowMinutes !== undefined && (!Number.isInteger(rule.windowMinutes) || rule.windowMinutes < 1 || rule.windowMinutes > 1440)) throw new Error('Alert window must be between 1 and 1440 minutes');
        if (rule.severity !== undefined && !SEVERITIES.has(rule.severity)) throw new Error('Unsupported alert severity');
        return rule;
    }

    listRules(clientId) { return this.repository.listRules(clientId); }
    listIncidents(clientId, status) { return this.repository.listIncidents(clientId, status); }

    async createRule(clientId, input, createdBy) {
        const rule = this.validateRule(input);
        return this.repository.createRule({ ...rule, clientId, createdBy, enabled: rule.enabled ?? true, severity: rule.severity || 'warning' });
    }

    async updateRule(id, clientId, input) {
        return this.repository.updateRule(id, clientId, this.validateRule(input, true));
    }

    deleteRule(id, clientId) { return this.repository.deleteRule(id, clientId); }

    async testWebhook({ channel, url }) {
        if (!url) throw new Error('Webhook URL is required');
        if (!this.notificationDispatcher) throw new Error('NotificationDispatcher is not available');

        const sampleRule = {
            name: 'PulseWatch Test Alert',
            metric: 'error_rate',
            operator: '>',
            threshold: 5,
            severity: 'warning',
            service_name: 'api-service',
            endpoint: '/api/v1/checkout',
        };
        const sampleIncident = {
            message: 'Test notification triggered from PulseWatch Alerts Dashboard.',
            opened_at: new Date().toISOString(),
        };

        if (channel === 'slack') {
            return await this.notificationDispatcher.sendSlack(url, { rule: sampleRule, incident: sampleIncident, status: 'triggered' });
        } else if (channel === 'discord') {
            return await this.notificationDispatcher.sendDiscord(url, { rule: sampleRule, incident: sampleIncident, status: 'triggered' });
        } else {
            return await this.notificationDispatcher.sendWebhook(url, { rule: sampleRule, incident: sampleIncident, status: 'triggered' });
        }
    }
}