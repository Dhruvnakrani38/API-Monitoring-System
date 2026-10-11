import http from 'http';
import https from 'https';
import logger from '../../../shared/config/logger.js';

export class NotificationDispatcher {
    constructor() {
        this.timeoutMs = 5000;
    }

    async postJson(targetUrl, payload) {
        if (!targetUrl) return { success: false, error: 'No URL provided' };

        return new Promise((resolve) => {
            try {
                const parsedUrl = new URL(targetUrl);
                const isHttps = parsedUrl.protocol === 'https:';
                const client = isHttps ? https : http;
                const bodyString = JSON.stringify(payload);

                const req = client.request({
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || (isHttps ? 443 : 80),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(bodyString),
                        'User-Agent': 'PulseWatch-Alert-Notifier/1.0',
                    },
                    timeout: this.timeoutMs,
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => { data += chunk; });
                    res.on('end', () => {
                        const success = res.statusCode >= 200 && res.statusCode < 300;
                        resolve({ success, statusCode: res.statusCode, body: data });
                    });
                });

                req.on('error', (err) => {
                    resolve({ success: false, error: err.message });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({ success: false, error: 'Request timed out' });
                });

                req.write(bodyString);
                req.end();
            } catch (err) {
                resolve({ success: false, error: err.message });
            }
        });
    }

    /**
     * Dispatch rich alert to Slack Incoming Webhook
     */
    async sendSlack(webhookUrl, { rule, incident, status = 'triggered' }) {
        if (!webhookUrl) return;
        const isResolved = status === 'resolved';
        const color = isResolved ? '#2ecc71' : (rule.severity === 'critical' ? '#e74c3c' : '#f39c12');
        const icon = isResolved ? '🟢' : (rule.severity === 'critical' ? '🚨' : '⚠️');
        const title = isResolved ? `[RESOLVED] ${rule.name}` : `[ALERT] ${rule.name}`;

        const payload = {
            attachments: [
                {
                    color,
                    blocks: [
                        {
                            type: 'header',
                            text: { type: 'plain_text', text: `${icon} ${title}`, emoji: true }
                        },
                        {
                            type: 'section',
                            fields: [
                                { type: 'mrkdwn', text: `*Metric:*\n\`${rule.metric}\`` },
                                { type: 'mrkdwn', text: `*Severity:*\n\`${rule.severity?.toUpperCase() || 'WARNING'}\`` },
                                { type: 'mrkdwn', text: `*Condition:*\n${rule.operator} ${rule.threshold}` },
                                { type: 'mrkdwn', text: `*Service:*\n${rule.service_name || rule.serviceName || 'All Services'}` },
                            ]
                        },
                        {
                            type: 'section',
                            text: { type: 'mrkdwn', text: `*Details:* ${incident?.message || (isResolved ? 'Metric recovered below threshold' : 'Threshold exceeded')}` }
                        },
                        {
                            type: 'context',
                            elements: [
                                { type: 'mrkdwn', text: `PulseWatch Monitoring | Timestamp: <!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toISOString()}>` }
                            ]
                        }
                    ]
                }
            ]
        };

        const res = await this.postJson(webhookUrl, payload);
        if (!res.success) {
            logger.warn('Failed to dispatch Slack alert', { url: webhookUrl, error: res.error || res.body });
        }
        return res;
    }

    /**
     * Dispatch rich embed alert to Discord Webhook
     */
    async sendDiscord(webhookUrl, { rule, incident, status = 'triggered' }) {
        if (!webhookUrl) return;
        const isResolved = status === 'resolved';
        const color = isResolved ? 0x2ecc71 : (rule.severity === 'critical' ? 0xe74c3c : 0xf39c12);
        const title = isResolved ? `🟢 [RESOLVED] ${rule.name}` : `🚨 [ALERT] ${rule.name}`;

        const payload = {
            embeds: [
                {
                    title,
                    description: incident?.message || (isResolved ? 'Metric has returned to normal levels.' : 'Alert threshold breached.'),
                    color,
                    fields: [
                        { name: 'Metric', value: `\`${rule.metric}\``, inline: true },
                        { name: 'Condition', value: `${rule.operator} ${rule.threshold}`, inline: true },
                        { name: 'Severity', value: rule.severity?.toUpperCase() || 'WARNING', inline: true },
                        { name: 'Service', value: rule.service_name || rule.serviceName || 'All Services', inline: true },
                        { name: 'Endpoint', value: rule.endpoint || 'All Endpoints', inline: true },
                        { name: 'Status', value: isResolved ? 'Resolved' : 'Active Incident', inline: true }
                    ],
                    footer: { text: 'PulseWatch API Monitoring' },
                    timestamp: new Date().toISOString()
                }
            ]
        };

        const res = await this.postJson(webhookUrl, payload);
        if (!res.success) {
            logger.warn('Failed to dispatch Discord alert', { url: webhookUrl, error: res.error || res.body });
        }
        return res;
    }

    /**
     * Dispatch generic JSON webhook payload
     */
    async sendWebhook(webhookUrl, { rule, incident, status = 'triggered' }) {
        if (!webhookUrl) return;

        const payload = {
            event: status === 'resolved' ? 'alert.resolved' : 'alert.triggered',
            timestamp: new Date().toISOString(),
            rule: {
                id: rule.id,
                name: rule.name,
                metric: rule.metric,
                operator: rule.operator,
                threshold: rule.threshold,
                severity: rule.severity,
                serviceName: rule.service_name || rule.serviceName,
                endpoint: rule.endpoint,
            },
            incident: incident ? {
                id: incident.id,
                status: incident.status,
                value: incident.value,
                message: incident.message,
                openedAt: incident.opened_at,
                lastSeenAt: incident.last_seen_at
            } : null
        };

        const res = await this.postJson(webhookUrl, payload);
        if (!res.success) {
            logger.warn('Failed to dispatch custom webhook alert', { url: webhookUrl, error: res.error || res.body });
        }
        return res;
    }

    /**
     * Route notification to all configured channels for an alert rule
     */
    async dispatchAlert({ rule, incident, status = 'triggered' }) {
        const promises = [];

        const slackUrl = rule.slack_webhook_url || rule.slackWebhookUrl;
        if (slackUrl) {
            promises.push(this.sendSlack(slackUrl, { rule, incident, status }));
        }

        const discordUrl = rule.discord_webhook_url || rule.discordWebhookUrl;
        if (discordUrl) {
            promises.push(this.sendDiscord(discordUrl, { rule, incident, status }));
        }

        const webhookUrl = rule.webhook_url || rule.webhookUrl;
        if (webhookUrl) {
            promises.push(this.sendWebhook(webhookUrl, { rule, incident, status }));
        }

        return Promise.allSettled(promises);
    }
}
