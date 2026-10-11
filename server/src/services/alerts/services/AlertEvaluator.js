const compare = (value, operator, threshold) => ({
    '>': value > threshold,
    '>=': value >= threshold,
    '<': value < threshold,
    '<=': value <= threshold,
}[operator]);

export class AlertEvaluator {
    constructor({ alertRepository, metricsRepository, notificationDispatcher, logger }) {
        this.alertRepository = alertRepository;
        this.metricsRepository = metricsRepository;
        this.notificationDispatcher = notificationDispatcher;
        this.logger = logger;
    }

    async evaluateAll() {
        try {
            const rules = await this.alertRepository.listEnabledRules();
            for (const rule of rules) {
                try {
                    await this.evaluateRule(rule);
                } catch (err) {
                    this.logger?.error?.(`Failed to evaluate alert rule ${rule.id}:`, err);
                }
            }
        } catch (err) {
            this.logger?.error?.('Failed to fetch enabled alert rules:', err);
        }
    }

    async evaluateRule(rule) {
        const metric = await this.metricsRepository.getAlertWindowMetric(rule);
        const total = Number(metric.total_hits) || 0;
        const errors = Number(metric.error_hits) || 0;
        const value = rule.metric === 'error_rate'
            ? (total ? (errors / total) * 100 : 0)
            : rule.metric === 'error_count'
                ? errors
                : rule.metric === 'avg_latency'
                    ? Number(metric.avg_latency) || 0
                    : total === 0 ? 1 : 0;
        const breached = compare(value, rule.operator, Number(rule.threshold));
        const openIncident = await this.alertRepository.findOpenIncident(rule.id);
        const message = `${rule.name}: ${rule.metric} is ${value.toFixed(2)} (threshold ${rule.operator} ${rule.threshold})`;

        if (breached && !openIncident) {
            const incident = await this.alertRepository.openIncident(rule, value, message);
            if (this.notificationDispatcher) {
                try {
                    await this.notificationDispatcher.dispatchAlert({ rule, incident, status: 'triggered' });
                } catch (dispatchErr) {
                    this.logger?.warn?.('Failed to dispatch alert notification:', dispatchErr);
                }
            }
        } else if (breached && openIncident) {
            await this.alertRepository.touchIncident(openIncident.id, value, message);
        } else if (!breached && openIncident) {
            const resolvedIncident = await this.alertRepository.resolveIncident(openIncident.id);
            if (this.notificationDispatcher) {
                try {
                    await this.notificationDispatcher.dispatchAlert({ rule, incident: resolvedIncident || openIncident, status: 'resolved' });
                } catch (dispatchErr) {
                    this.logger?.warn?.('Failed to dispatch resolved notification:', dispatchErr);
                }
            }
        }
    }
}