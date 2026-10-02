import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, Trash2, Plus, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { clientApi, syntheticsApi } from '../api/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui';
import pageStyles from '../styles/modules/pages/PageComponents.module.scss';
import styles from '../styles/modules/pages/SyntheticPage.module.scss';

const initialForm = {
    name: '',
    url: '',
    method: 'GET',
    expectedStatus: 200,
    timeoutMs: 10000,
    intervalSeconds: 60,
    headersJson: '',
    body: '',
    maxLatencyMs: '',
    failureThreshold: 3,
};

export function SyntheticPage({ currentUser }) {
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const canManage = isSuperAdmin || currentUser?.role === 'client_admin';
    const [clientId, setClientId] = useState(currentUser?.clientId || '');
    const [form, setForm] = useState(initialForm);
    const [assertions, setAssertions] = useState([]);
    const [newAstType, setNewAstType] = useState('json_path');
    const [newAstPath, setNewAstPath] = useState('$.status');
    const [newAstValue, setNewAstValue] = useState('active');
    const [newAstKey, setNewAstKey] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const queryClient = useQueryClient();

    const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: clientApi.getClients, enabled: isSuperAdmin });
    const clients = clientsQuery.data?.data || [];

    useEffect(() => {
        if (isSuperAdmin && !clientId && clients[0]?._id) setClientId(clients[0]._id);
    }, [clients, clientId, isSuperAdmin]);

    const checksQuery = useQuery({ queryKey: ['synthetics', clientId || 'all'], queryFn: () => syntheticsApi.getChecks(clientId || undefined) });
    const runsQuery = useQuery({ queryKey: ['syntheticRuns', selectedId, clientId], queryFn: () => syntheticsApi.getRuns(selectedId, clientId || undefined), enabled: Boolean(selectedId) });

    const createMutation = useMutation({
        mutationFn: () => {
            let parsedHeaders = {};
            if (form.headersJson.trim()) {
                try { parsedHeaders = JSON.parse(form.headersJson); } catch (e) { throw new Error('Headers must be valid JSON'); }
            }
            return syntheticsApi.createCheck({
                ...form,
                clientId: clientId || undefined,
                expectedStatus: Number(form.expectedStatus),
                timeoutMs: Number(form.timeoutMs),
                intervalSeconds: Number(form.intervalSeconds),
                maxLatencyMs: form.maxLatencyMs ? Number(form.maxLatencyMs) : null,
                failureThreshold: Number(form.failureThreshold || 3),
                headers: parsedHeaders,
                assertions,
            });
        },
        onSuccess: () => {
            setForm(initialForm);
            setAssertions([]);
            queryClient.invalidateQueries({ queryKey: ['synthetics'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => syntheticsApi.deleteCheck(id, clientId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['synthetics'] }),
    });

    const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

    const addAssertion = () => {
        let ast = null;
        if (newAstType === 'json_path') {
            if (!newAstPath) return;
            ast = { type: 'json_path', path: newAstPath, expected: newAstValue, operator: 'equals' };
        } else if (newAstType === 'header_contains') {
            if (!newAstKey) return;
            ast = { type: 'header_contains', key: newAstKey, value: newAstValue };
        } else if (newAstType === 'body_contains') {
            if (!newAstValue) return;
            ast = { type: 'body_contains', value: newAstValue };
        } else if (newAstType === 'body_not_contains') {
            if (!newAstValue) return;
            ast = { type: 'body_not_contains', value: newAstValue };
        } else if (newAstType === 'max_latency') {
            if (!newAstValue) return;
            ast = { type: 'max_latency', value: Number(newAstValue) };
        }
        if (ast) {
            setAssertions((prev) => [...prev, ast]);
            setNewAstValue('');
            setNewAstKey('');
        }
    };

    const removeAssertion = (index) => {
        setAssertions((prev) => prev.filter((_, i) => i !== index));
    };

    const formatStatusBadge = (status) => {
        if (status === 'failing') return <span className={`${styles.badge} ${styles.badgeFail}`}><XCircle size={12} /> Failing</span>;
        if (status === 'degraded') return <span className={`${styles.badge} ${styles.badgeDegraded}`}><AlertTriangle size={12} /> Degraded</span>;
        return <span className={`${styles.badge} ${styles.badgePass}`}><CheckCircle2 size={12} /> Healthy</span>;
    };

    return (
        <div className={pageStyles.pageContainer}>
            <div className={pageStyles.pageHeader}>
                <div className={pageStyles.headerWithActions}>
                    <div>
                        <h2>Synthetic Checks & Response Assertions</h2>
                        <p>Validate real API functional behavior, response schemas, latencies, and multi-assertion rules.</p>
                    </div>
                    {isSuperAdmin && (
                        <label className={pageStyles.clientScope}>
                            <span>Client</span>
                            <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                                <option value="">All clients</option>
                                {clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
                            </select>
                        </label>
                    )}
                </div>
            </div>

            <div className={styles.grid}>
                {canManage && (
                    <Card className={pageStyles.sectionCard}>
                        <CardHeader>
                            <div className={pageStyles.cardTitleRow}>
                                <Globe2 className={pageStyles.cardTitleIcon} />
                                <CardTitle>Create Advanced Synthetic Check</CardTitle>
                            </div>
                            <CardDescription>Configure request payloads, headers, response assertions, and failure thresholds.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className={styles.form} onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
                                <label>Name
                                    <input value={form.name} onChange={update('name')} placeholder="User Authentication API" required />
                                </label>

                                <label>Target URL
                                    <input type="url" value={form.url} onChange={update('url')} placeholder="https://api.example.com/v1/auth/login" required />
                                </label>

                                <div className={styles.row}>
                                    <label>Method
                                        <select value={form.method} onChange={update('method')}>
                                            <option>GET</option>
                                            <option>POST</option>
                                            <option>PUT</option>
                                            <option>PATCH</option>
                                            <option>DELETE</option>
                                            <option>HEAD</option>
                                        </select>
                                    </label>
                                    <label>Expected Status Code
                                        <input type="number" value={form.expectedStatus} onChange={update('expectedStatus')} required />
                                    </label>
                                </div>

                                <div className={styles.row}>
                                    <label>Timeout (ms)
                                        <input type="number" value={form.timeoutMs} onChange={update('timeoutMs')} />
                                    </label>
                                    <label>Check Interval (seconds)
                                        <input type="number" value={form.intervalSeconds} onChange={update('intervalSeconds')} />
                                    </label>
                                </div>

                                <div className={styles.row}>
                                    <label>Max Allowed Latency (ms, optional)
                                        <input type="number" value={form.maxLatencyMs} onChange={update('maxLatencyMs')} placeholder="e.g. 500" />
                                    </label>
                                    <label>Failure Threshold (Consecutive fails)
                                        <input type="number" value={form.failureThreshold} onChange={update('failureThreshold')} min={1} max={10} />
                                    </label>
                                </div>

                                <label>Custom Headers (JSON format)
                                    <textarea
                                        rows={2}
                                        value={form.headersJson}
                                        onChange={update('headersJson')}
                                        placeholder='{"Authorization": "Bearer {{TOKEN}}", "Content-Type": "application/json"}'
                                    />
                                </label>

                                {['POST', 'PUT', 'PATCH'].includes(form.method) && (
                                    <label>Request Body Payload
                                        <textarea
                                            rows={3}
                                            value={form.body}
                                            onChange={update('body')}
                                            placeholder='{"email": "user@example.com", "password": "password123"}'
                                        />
                                    </label>
                                )}

                                <div className={styles.assertionBox}>
                                    <div className={styles.assertionBoxHeader}>
                                        <ShieldCheck size={16} />
                                        <span>Response Assertions ({assertions.length})</span>
                                    </div>
                                    <div className={styles.assertionInputs}>
                                        <select value={newAstType} onChange={(e) => setNewAstType(e.target.value)}>
                                            <option value="json_path">JSONPath Validation</option>
                                            <option value="header_contains">Header Substring</option>
                                            <option value="body_contains">Body Contains Text</option>
                                            <option value="body_not_contains">Body Excludes Text</option>
                                            <option value="max_latency">Specific Latency Limit (ms)</option>
                                        </select>
                                        {newAstType === 'json_path' && (
                                            <input value={newAstPath} onChange={(e) => setNewAstPath(e.target.value)} placeholder="$.data.status" />
                                        )}
                                        {newAstType === 'header_contains' && (
                                            <input value={newAstKey} onChange={(e) => setNewAstKey(e.target.value)} placeholder="Header key (content-type)" />
                                        )}
                                        <input value={newAstValue} onChange={(e) => setNewAstValue(e.target.value)} placeholder="Expected value" />
                                        <button type="button" onClick={addAssertion} className={styles.addAstBtn}>
                                            <Plus size={14} /> Add
                                        </button>
                                    </div>
                                    <div className={styles.assertionList}>
                                        {assertions.map((ast, idx) => (
                                            <div key={idx} className={styles.assertionItem}>
                                                <span>
                                                    <strong>{ast.type}</strong>: {ast.path || ast.key || ''} = {String(ast.expected || ast.value)}
                                                </span>
                                                <button type="button" onClick={() => removeAssertion(idx)}><Trash2 size={13} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {createMutation.isError && (
                                    <div className={styles.errorBanner}>{createMutation.error.message}</div>
                                )}

                                <button disabled={createMutation.isPending || (isSuperAdmin && !clientId)}>
                                    <Globe2 size={16} /> Create Scheduled Synthetic Check
                                </button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <Card className={pageStyles.sectionCard}>
                    <CardHeader>
                        <CardTitle>Configured Synthetic Checks</CardTitle>
                        <CardDescription>{checksQuery.data?.data?.length || 0} active monitors</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className={styles.list}>
                            {checksQuery.data?.data?.map((check) => (
                                <div
                                    className={`${styles.check} ${selectedId === check.id ? styles.selectedCheck : ''}`}
                                    key={check.id}
                                    onClick={() => setSelectedId(check.id)}
                                >
                                    <div>
                                        <div className={styles.checkHeaderRow}>
                                            <strong>{check.name}</strong>
                                            {formatStatusBadge(check.status)}
                                        </div>
                                        <span>{check.method} {check.url}</span>
                                        <small>
                                            Every {check.interval_seconds}s · Expected {check.expected_status}
                                            {check.max_latency_ms ? ` · Max ${check.max_latency_ms}ms` : ''}
                                            {check.failure_threshold ? ` · Threshold: ${check.failure_threshold} fails` : ''}
                                        </small>
                                    </div>
                                    {canManage && (
                                        <button
                                            type="button"
                                            title="Delete check"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                deleteMutation.mutate(check.id);
                                            }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {selectedId && (
                <Card className={pageStyles.sectionCard} style={{ marginTop: '1.5rem' }}>
                    <CardHeader>
                        <CardTitle>Execution & Assertion History</CardTitle>
                        <CardDescription>Recent check runs and assertion results for selected monitor</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className={styles.list}>
                            {runsQuery.data?.data?.map((run) => {
                                const assertionResults = typeof run.assertion_results === 'string'
                                    ? JSON.parse(run.assertion_results || '[]')
                                    : (run.assertion_results || []);
                                return (
                                    <div className={styles.runCard} key={run.id}>
                                        <div className={styles.runMainRow}>
                                            <span className={run.success ? styles.pass : styles.fail}>
                                                {run.success ? 'PASS' : 'FAIL'}
                                            </span>
                                            <span className={styles.runCode}>
                                                {run.status_code ? `Status ${run.status_code}` : 'Network Error'}
                                            </span>
                                            <span className={styles.runLatency}>
                                                {run.latency_ms ? `${run.latency_ms} ms` : ''}
                                            </span>
                                            <span className={styles.runAssertionsCount}>
                                                Assertions: {run.passed_assertions || 0}/{run.total_assertions || 0} passed
                                            </span>
                                            <time>{new Date(run.checked_at).toLocaleString()}</time>
                                        </div>
                                        {assertionResults.length > 0 && (
                                            <div className={styles.runAssertionDetails}>
                                                {assertionResults.map((ast, i) => (
                                                    <div key={i} className={ast.passed ? styles.astPassed : styles.astFailed}>
                                                        {ast.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                        <span>{ast.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {run.error_message && (
                                            <div className={styles.errorMessageText}>{run.error_message}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}