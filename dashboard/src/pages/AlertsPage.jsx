import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, Plus, Trash2 } from 'lucide-react';
import { alertsApi, clientApi } from '../api/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui';
import styles from '../styles/modules/pages/AlertsPage.module.scss';
import pageStyles from '../styles/modules/pages/PageComponents.module.scss';

const emptyRule = {
    name: '',
    metric: 'error_rate',
    operator: '>',
    threshold: 5,
    windowMinutes: 5,
    severity: 'warning',
    serviceName: '',
    endpoint: '',
    enabled: true,
    slackWebhookUrl: '',
    discordWebhookUrl: '',
    webhookUrl: '',
};

export function AlertsPage({ currentUser }) {
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const canManage = isSuperAdmin || currentUser?.role === 'client_admin';
    const [selectedClientId, setSelectedClientId] = useState(currentUser?.clientId || '');
    const [rule, setRule] = useState(emptyRule);
    const [testingChannel, setTestingChannel] = useState(null);
    const [testFeedback, setTestFeedback] = useState(null);

    const queryClient = useQueryClient();
    const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: clientApi.getClients, enabled: isSuperAdmin });
    const clients = clientsQuery.data?.data || [];

    useEffect(() => {
        if (isSuperAdmin && !selectedClientId && clients[0]?._id) setSelectedClientId(clients[0]._id);
    }, [clients, isSuperAdmin, selectedClientId]);

    const rulesQuery = useQuery({
        queryKey: ['alertRules', selectedClientId || 'all'],
        queryFn: () => alertsApi.getRules(selectedClientId || undefined),
    });
    const incidentsQuery = useQuery({
        queryKey: ['alertIncidents', selectedClientId || 'all'],
        queryFn: () => alertsApi.getIncidents(selectedClientId || undefined),
    });
    const createMutation = useMutation({
        mutationFn: () => alertsApi.createRule({
            ...rule,
            clientId: selectedClientId || undefined,
            threshold: Number(rule.threshold),
            windowMinutes: Number(rule.windowMinutes),
        }),
        onSuccess: () => {
            setRule(emptyRule);
            setTestFeedback(null);
            queryClient.invalidateQueries({ queryKey: ['alertRules'] });
        },
    });
    const toggleMutation = useMutation({
        mutationFn: ({ id, enabled }) => alertsApi.updateRule(id, { enabled }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertRules'] }),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => alertsApi.deleteRule(id, selectedClientId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alertRules'] }),
    });

    const updateField = (field) => (event) => setRule((current) => ({ ...current, [field]: event.target.value }));

    const handleTestWebhook = async (channel, url) => {
        if (!url) return;
        setTestingChannel(channel);
        setTestFeedback(null);
        try {
            await alertsApi.testWebhook({ channel, url });
            setTestFeedback({ channel, success: true, message: `✅ Test alert dispatched to ${channel}!` });
        } catch (err) {
            setTestFeedback({ channel, success: false, message: `❌ Failed: ${err.response?.data?.message || 'Check URL'}` });
        } finally {
            setTestingChannel(null);
        }
    };

    return (
        <div className={pageStyles.pageContainer}>
            <div className={pageStyles.pageHeader}>
                <div className={pageStyles.headerWithActions}>
                    <div><h2>Alerts & Incidents</h2><p>Turn endpoint signals into actionable multi-channel reliability work.</p></div>
                    {isSuperAdmin && <label className={pageStyles.clientScope}><span>Client</span><select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}><option value="">All clients</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label>}
                </div>
            </div>

            <div className={styles.grid}>
                {canManage && <Card className={pageStyles.sectionCard}>
                    <CardHeader><div className={pageStyles.cardTitleRow}><Plus className={pageStyles.cardTitleIcon} /><CardTitle>Create alert rule</CardTitle></div><CardDescription>Rules evaluate telemetry and dispatch rich alerts to Slack, Discord & Webhooks.</CardDescription></CardHeader>
                    <CardContent><form className={styles.form} onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
                        <label>Name<input value={rule.name} onChange={updateField('name')} placeholder="Checkout High Error Rate" required /></label>
                        <div className={styles.formRow}><label>Metric<select value={rule.metric} onChange={updateField('metric')}><option value="error_rate">Error rate (%)</option><option value="error_count">Error count</option><option value="avg_latency">Average latency (ms)</option><option value="no_data">No data</option></select></label><label>Condition<select value={rule.operator} onChange={updateField('operator')}><option>&gt;</option><option>&gt;=</option><option>&lt;</option><option>&lt;=</option></select></label></div>
                        <div className={styles.formRow}><label>Threshold<input type="number" step="0.01" value={rule.threshold} onChange={updateField('threshold')} required /></label><label>Window (minutes)<input type="number" min="1" max="1440" value={rule.windowMinutes} onChange={updateField('windowMinutes')} required /></label></div>
                        <div className={styles.formRow}><label>Service (optional)<input value={rule.serviceName} onChange={updateField('serviceName')} placeholder="checkout-api" /></label><label>Severity<select value={rule.severity} onChange={updateField('severity')}><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label></div>
                        <label>Endpoint (optional)<input value={rule.endpoint} onChange={updateField('endpoint')} placeholder="/api/v1/checkout" /></label>

                        <div className={styles.channelSection}>
                            <span className={styles.channelTitle}>🔔 Multi-Channel Alert Routing</span>

                            <label>Slack Webhook URL
                                <div className={styles.channelRow}>
                                    <input value={rule.slackWebhookUrl} onChange={updateField('slackWebhookUrl')} placeholder="https://hooks.slack.com/services/..." />
                                    <button type="button" className={styles.testButton} disabled={!rule.slackWebhookUrl || testingChannel === 'slack'} onClick={() => handleTestWebhook('slack', rule.slackWebhookUrl)}>
                                        {testingChannel === 'slack' ? 'Sending…' : 'Test Slack'}
                                    </button>
                                </div>
                            </label>

                            <label>Discord Webhook URL
                                <div className={styles.channelRow}>
                                    <input value={rule.discordWebhookUrl} onChange={updateField('discordWebhookUrl')} placeholder="https://discord.com/api/webhooks/..." />
                                    <button type="button" className={styles.testButton} disabled={!rule.discordWebhookUrl || testingChannel === 'discord'} onClick={() => handleTestWebhook('discord', rule.discordWebhookUrl)}>
                                        {testingChannel === 'discord' ? 'Sending…' : 'Test Discord'}
                                    </button>
                                </div>
                            </label>

                            <label>Custom HTTP Webhook URL
                                <div className={styles.channelRow}>
                                    <input value={rule.webhookUrl} onChange={updateField('webhookUrl')} placeholder="https://api.yourcompany.com/webhooks/alerts" />
                                    <button type="button" className={styles.testButton} disabled={!rule.webhookUrl || testingChannel === 'custom'} onClick={() => handleTestWebhook('custom', rule.webhookUrl)}>
                                        {testingChannel === 'custom' ? 'Sending…' : 'Test Webhook'}
                                    </button>
                                </div>
                            </label>

                            {testFeedback && (
                                <p className={`${styles.testFeedback} ${testFeedback.success ? styles.testSuccess : styles.testError}`}>
                                    {testFeedback.message}
                                </p>
                            )}
                        </div>

                        <button type="submit" disabled={createMutation.isPending || (isSuperAdmin && !selectedClientId)}><BellRing size={16} />{createMutation.isPending ? 'Creating…' : 'Create rule'}</button>
                        {createMutation.isError && <p className={styles.error}>{createMutation.error.response?.data?.message || createMutation.error.message}</p>}
                    </form></CardContent>
                </Card>}

                <Card className={pageStyles.sectionCard}><CardHeader><div className={pageStyles.cardTitleRow}><BellRing className={pageStyles.cardTitleIcon} /><CardTitle>Rules & Notification Channels</CardTitle></div><CardDescription>{rulesQuery.data?.data?.length || 0} configured rules</CardDescription></CardHeader><CardContent><div className={styles.ruleList}>{rulesQuery.data?.data?.map((item) => <div className={styles.ruleRow} key={item.id}><div><strong>{item.name}</strong><span>{item.metric} {item.operator} {item.threshold} · {item.window_minutes}m · {item.severity}</span><div className={styles.badgesRow}>{item.slack_webhook_url && <span className={`${styles.channelBadge} ${styles.badgeSlack}`}>Slack</span>}{item.discord_webhook_url && <span className={`${styles.channelBadge} ${styles.badgeDiscord}`}>Discord</span>}{item.webhook_url && <span className={`${styles.channelBadge} ${styles.badgeWebhook}`}>Webhook</span>}</div></div><div className={styles.ruleActions}><button type="button" onClick={() => toggleMutation.mutate({ id: item.id, enabled: !item.enabled })}>{item.enabled ? 'Enabled' : 'Disabled'}</button>{canManage && <button type="button" className={styles.iconButton} title="Delete rule" onClick={() => deleteMutation.mutate(item.id)}><Trash2 size={15} /></button>}</div></div>)}</div></CardContent></Card>
            </div>

            <Card className={pageStyles.sectionCard}><CardHeader><div className={pageStyles.cardTitleRow}><Check className={pageStyles.cardTitleIcon} /><CardTitle>Incident history</CardTitle></div><CardDescription>Open and resolved alert events for the selected client.</CardDescription></CardHeader><CardContent><div className={styles.incidentList}>{incidentsQuery.data?.data?.length ? incidentsQuery.data.data.map((incident) => <div className={styles.incidentRow} key={incident.id}><span className={`${styles.status} ${styles[incident.status]}`}>{incident.status}</span><div><strong>{incident.rule_name}</strong><span>{incident.message}</span></div><time>{new Date(incident.last_seen_at).toLocaleString()}</time></div>) : <p className={styles.empty}>No incidents recorded yet.</p>}</div></CardContent></Card>
        </div>
    );
}