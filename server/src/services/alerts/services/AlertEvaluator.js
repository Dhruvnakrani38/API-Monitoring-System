const compare = (value, operator, threshold) => ({
    '>': value > threshold,
    '>=': value >= threshold,
    '<': value < threshold,
    '<=': value <= threshold,
}[operator]);

export class AlertEvaluator {
    constructor({ alertRepository, metricsRepository, logger }) {
        this.alertRepository = alertRepository;
        this.metricsRepository = metricsRepository;
        this.logger = logger;
    }

    async evaluateAll() {
        const rules = await this.alertRepository.listEnabledRules();
        for (const rule of rules) await this.evaluateRule(rule);
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

        if (breached && !openIncident) await this.alertRepository.openIncident(rule, value, message);
        else if (breached && openIncident) await this.alertRepository.touchIncident(openIncident.id, value, message);
        else if (!breached && openIncident) await this.alertRepository.resolveIncident(openIncident.id);
    }
}