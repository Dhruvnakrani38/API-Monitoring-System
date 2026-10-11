import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Workflow, Plus, Trash2, Play, ChevronDown, ChevronUp,
    CheckCircle2, XCircle, Clock, Loader2, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { clientApi, journeysApi } from '../api/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui';
import pageStyles from '../styles/modules/pages/PageComponents.module.scss';
import styles from '../styles/modules/pages/JourneysPage.module.scss';

/* ── helpers ───────────────────────────────────────────── */
const STATUS_ICON = {
    pass: <CheckCircle2 size={14} className={styles.iconPass} />,
    fail: <XCircle size={14} className={styles.iconFail} />,
    pending: <Clock size={14} className={styles.iconPending} />,
};

const emptyStep = () => ({
    name: '',
    url: '',
    method: 'GET',
    headersJson: '',
    body: '',
    expectedStatus: 200,
    extractVars: [],
    assertions: [],
});

/* ── sub-component: Step Builder ───────────────────────── */
function StepBuilder({ step, index, onChange, onRemove }) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [newVar, setNewVar] = useState({ varName: '', jsonPath: '' });
    const [newAssertion, setNewAssertion] = useState({ type: 'json_path', path: '$.status', expected: '' });

    const update = (field) => (e) => onChange(index, { ...step, [field]: e.target.value });

    const addVar = () => {
        if (!newVar.varName || !newVar.jsonPath) return;
        onChange(index, { ...step, extractVars: [...step.extractVars, { ...newVar }] });
        setNewVar({ varName: '', jsonPath: '' });
    };
    const removeVar = (i) => onChange(index, { ...step, extractVars: step.extractVars.filter((_, idx) => idx !== i) });

    const addAssertion = () => {
        if (!newAssertion.expected) return;
        onChange(index, { ...step, assertions: [...step.assertions, { ...newAssertion }] });
        setNewAssertion({ type: 'json_path', path: '$.status', expected: '' });
    };
    const removeAssertion = (i) => onChange(index, { ...step, assertions: step.assertions.filter((_, idx) => idx !== i) });

    return (
        <div className={styles.stepCard}>
            <div className={styles.stepHeader}>
                <span className={styles.stepBadge}>Step {index + 1}</span>
                <button type="button" className={styles.removeStepBtn} onClick={() => onRemove(index)}>
                    <Trash2 size={14} /> Remove
                </button>
            </div>

            <div className={styles.stepGrid}>
                <div className={styles.formGroup}>
                    <label>Step Name</label>
                    <input value={step.name} onChange={update('name')} placeholder="e.g. Login" className={styles.input} />
                </div>
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                    <label>URL</label>
                    <input value={step.url} onChange={update('url')} placeholder="https://api.example.com/path" className={styles.input} />
                </div>
                <div className={styles.formGroup}>
                    <label>Method</label>
                    <select value={step.method} onChange={update('method')} className={styles.select}>
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label>Expected Status</label>
                    <input type="number" value={step.expectedStatus} onChange={update('expectedStatus')} className={styles.input} />
                </div>
            </div>

            <button type="button" className={styles.advancedToggle} onClick={() => setShowAdvanced(v => !v)}>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAdvanced ? 'Hide' : 'Show'} advanced options
            </button>

            {showAdvanced && (
                <div className={styles.advancedSection}>
                    <div className={styles.formGroup}>
                        <label>Headers (JSON)</label>
                        <textarea value={step.headersJson} onChange={update('headersJson')} placeholder='{"Authorization": "Bearer {{token}}"}' className={styles.textarea} rows={2} />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Body (JSON or text)</label>
                        <textarea value={step.body} onChange={update('body')} placeholder='{"username": "admin"}' className={styles.textarea} rows={3} />
                    </div>

                    <div className={styles.subsection}>
                        <h4>Extract Variables</h4>
                        <p className={styles.hint}>Extract response values to use as <code>{'{{varName}}'}</code> in later steps.</p>
                        {step.extractVars.map((v, i) => (
                            <div key={i} className={styles.tagRow}>
                                <code>{v.varName}</code><ArrowRight size={12} /><code>{v.jsonPath}</code>
                                <button type="button" onClick={() => removeVar(i)}><Trash2 size={12} /></button>
                            </div>
                        ))}
                        <div className={styles.inlineForm}>
                            <input value={newVar.varName} onChange={e => setNewVar(v => ({ ...v, varName: e.target.value }))} placeholder="varName" className={styles.inputSm} />
                            <input value={newVar.jsonPath} onChange={e => setNewVar(v => ({ ...v, jsonPath: e.target.value }))} placeholder="$.data.token" className={styles.inputSm} />
                            <button type="button" className={styles.addTagBtn} onClick={addVar}><Plus size={12} /> Add</button>
                        </div>
                    </div>

                    <div className={styles.subsection}>
                        <h4>Assertions</h4>
                        {step.assertions.map((a, i) => (
                            <div key={i} className={styles.tagRow}>
                                <code>{a.type}</code><code>{a.path}</code><span>=</span><code>{a.expected}</code>
                                <button type="button" onClick={() => removeAssertion(i)}><Trash2 size={12} /></button>
                            </div>
                        ))}
                        <div className={styles.inlineForm}>
                            <select value={newAssertion.type} onChange={e => setNewAssertion(v => ({ ...v, type: e.target.value }))} className={styles.selectSm}>
                                <option value="json_path">JSON Path</option>
                                <option value="header">Header</option>
                                <option value="status">Status Code</option>
                            </select>
                            <input value={newAssertion.path} onChange={e => setNewAssertion(v => ({ ...v, path: e.target.value }))} placeholder="$.message" className={styles.inputSm} />
                            <input value={newAssertion.expected} onChange={e => setNewAssertion(v => ({ ...v, expected: e.target.value }))} placeholder="expected value" className={styles.inputSm} />
                            <button type="button" className={styles.addTagBtn} onClick={addAssertion}><Plus size={12} /> Add</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── sub-component: Run History ─────────────────────────── */
function RunHistory({ journeyId, clientId }) {
    const { data, isLoading } = useQuery({
        queryKey: ['journeyRuns', journeyId, clientId],
        queryFn: () => journeysApi.getRuns(journeyId, clientId || undefined),
        refetchInterval: 10000,
    });

    const runs = data?.data ?? [];

    if (isLoading) return <div className={styles.loading}><Loader2 size={16} className={styles.spin} /> Loading runs…</div>;
    if (!runs.length) return <p className={styles.emptyHint}>No runs yet. Trigger one with the play button above.</p>;

    return (
        <div className={styles.runList}>
            {runs.map(run => (
                <div key={run.id} className={`${styles.runRow} ${run.status === 'pass' ? styles.runPass : styles.runFail}`}>
                    <span className={styles.runStatus}>{STATUS_ICON[run.status] ?? STATUS_ICON.pending} {run.status}</span>
                    <span className={styles.runDuration}>{run.duration_ms != null ? `${run.duration_ms} ms` : '—'}</span>
                    <span className={styles.runTime}>{new Date(run.started_at).toLocaleString()}</span>
                    {run.error_message && <span className={styles.runError}>{run.error_message}</span>}
                </div>
            ))}
        </div>
    );
}

/* ── main page ─────────────────────────────────────────── */
export function JourneysPage({ currentUser }) {
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const canManage = isSuperAdmin || currentUser?.role === 'client_admin';
    const [clientId, setClientId] = useState(currentUser?.clientId || '');
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState('');
    const [steps, setSteps] = useState([emptyStep()]);
    const [expandedId, setExpandedId] = useState(null);
    const queryClient = useQueryClient();

    const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: clientApi.getClients, enabled: isSuperAdmin });
    const clients = clientsQuery.data?.data ?? [];

    const journeysQuery = useQuery({
        queryKey: ['journeys', clientId || 'all'],
        queryFn: () => journeysApi.getJourneys(clientId || undefined),
    });
    const journeys = journeysQuery.data?.data ?? [];

    const createMutation = useMutation({
        mutationFn: () => {
            const builtSteps = steps.map(s => {
                let headers = {};
                if (s.headersJson.trim()) {
                    try { headers = JSON.parse(s.headersJson); } catch { throw new Error(`Step "${s.name}": Headers must be valid JSON`); }
                }
                let body = s.body;
                if (body.trim()) {
                    try { body = JSON.parse(body); } catch { /* leave as string */ }
                }
                return {
                    name: s.name,
                    url: s.url,
                    method: s.method,
                    expectedStatus: Number(s.expectedStatus),
                    headers,
                    body: body || undefined,
                    extractVars: s.extractVars,
                    assertions: s.assertions,
                };
            });
            return journeysApi.createJourney({ name, steps: builtSteps, clientId: clientId || undefined });
        },
        onSuccess: () => {
            setShowCreate(false);
            setName('');
            setSteps([emptyStep()]);
            queryClient.invalidateQueries({ queryKey: ['journeys'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => journeysApi.deleteJourney(id, clientId || undefined),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journeys'] }),
    });

    const triggerMutation = useMutation({
        mutationFn: (id) => journeysApi.triggerRun(id, clientId || undefined),
        onSuccess: (_, id) => queryClient.invalidateQueries({ queryKey: ['journeyRuns', id] }),
    });

    const handleStepChange = (index, updated) => setSteps(prev => prev.map((s, i) => i === index ? updated : s));
    const handleStepRemove = (index) => setSteps(prev => prev.filter((_, i) => i !== index));

    return (
        <div className={pageStyles.pageWrapper}>
            <div className={pageStyles.pageHeader}>
                <div className={pageStyles.pageHeaderLeft}>
                    <Workflow size={24} />
                    <div>
                        <h1 className={pageStyles.pageTitle}>Multi-Step Journeys</h1>
                        <p className={pageStyles.pageSubtitle}>Chain API calls into user-flow scenarios and monitor end-to-end health.</p>
                    </div>
                </div>
                <div className={pageStyles.pageHeaderRight}>
                    {isSuperAdmin && clients.length > 0 && (
                        <select value={clientId} onChange={e => setClientId(e.target.value)} className={pageStyles.clientSelect}>
                            <option value="">All clients</option>
                            {clients.map(c => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                        </select>
                    )}
                    {canManage && (
                        <button className={pageStyles.primaryBtn} onClick={() => setShowCreate(v => !v)}>
                            <Plus size={16} /> New Journey
                        </button>
                    )}
                </div>
            </div>

            {showCreate && (
                <Card className={styles.createCard}>
                    <CardHeader>
                        <CardTitle>Create Multi-Step Journey</CardTitle>
                        <CardDescription>Define a sequence of HTTP requests that simulate a real user workflow.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {createMutation.isError && (
                            <div className={styles.errorBanner}>
                                <AlertTriangle size={14} />
                                {createMutation.error?.message ?? 'Failed to create journey'}
                            </div>
                        )}
                        <div className={styles.formGroup}>
                            <label>Journey Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Full Checkout Flow" className={styles.input} />
                        </div>

                        <div className={styles.stepsContainer}>
                            {steps.map((step, i) => (
                                <div key={i} className={styles.stepWrapper}>
                                    <StepBuilder step={step} index={i} onChange={handleStepChange} onRemove={handleStepRemove} />
                                    {i < steps.length - 1 && <div className={styles.stepArrow}><ArrowRight size={20} /></div>}
                                </div>
                            ))}
                            <button type="button" className={styles.addStepBtn} onClick={() => setSteps(p => [...p, emptyStep()])}>
                                <Plus size={14} /> Add Step
                            </button>
                        </div>

                        <div className={styles.formActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                            <button
                                type="button"
                                className={styles.submitBtn}
                                disabled={createMutation.isPending || !name.trim() || steps.length === 0}
                                onClick={() => createMutation.mutate()}
                            >
                                {createMutation.isPending
                                    ? <><Loader2 size={14} className={styles.spin} /> Creating…</>
                                    : 'Create Journey'}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {journeysQuery.isLoading && (
                <div className={styles.loading}><Loader2 size={20} className={styles.spin} /> Loading journeys…</div>
            )}
            {!journeysQuery.isLoading && journeys.length === 0 && !showCreate && (
                <div className={styles.emptyState}>
                    <Workflow size={48} className={styles.emptyIcon} />
                    <h3>No journeys yet</h3>
                    <p>Create your first multi-step journey to simulate and monitor real user flows.</p>
                </div>
            )}

            <div className={styles.journeyList}>
                {journeys.map(journey => (
                    <Card key={journey.id} className={styles.journeyCard}>
                        <div className={styles.journeyCardHeader}>
                            <div className={styles.journeyMeta}>
                                <Workflow size={18} className={styles.journeyIcon} />
                                <div>
                                    <h3 className={styles.journeyName}>{journey.name}</h3>
                                    <p className={styles.journeyInfo}>
                                        {journey.step_count ?? 0} steps
                                        {journey.last_run_at && ` · Last run ${new Date(journey.last_run_at).toLocaleString()}`}
                                    </p>
                                </div>
                            </div>
                            <div className={styles.journeyActions}>
                                <span className={`${styles.statusBadge} ${journey.last_run_status === 'pass' ? styles.badgePass : journey.last_run_status === 'fail' ? styles.badgeFail : styles.badgeNone}`}>
                                    {journey.last_run_status ?? 'never run'}
                                </span>
                                <button className={styles.iconBtn} title="Trigger run" disabled={triggerMutation.isPending} onClick={() => triggerMutation.mutate(journey.id)}>
                                    {triggerMutation.isPending && triggerMutation.variables === journey.id
                                        ? <Loader2 size={16} className={styles.spin} />
                                        : <Play size={16} />}
                                </button>
                                <button className={styles.iconBtn} title="Run history" onClick={() => setExpandedId(prev => prev === journey.id ? null : journey.id)}>
                                    {expandedId === journey.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                {canManage && (
                                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Delete" onClick={() => deleteMutation.mutate(journey.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {expandedId === journey.id && (
                            <div className={styles.runsPanel}>
                                <RunHistory journeyId={journey.id} clientId={clientId} />
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}

export default JourneysPage;
