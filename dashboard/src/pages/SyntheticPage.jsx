import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, Trash2 } from 'lucide-react';
import { clientApi, syntheticsApi } from '../api/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui';
import pageStyles from '../styles/modules/pages/PageComponents.module.scss';
import styles from '../styles/modules/pages/SyntheticPage.module.scss';

const initial = { name: '', url: '', method: 'GET', expectedStatus: 200, timeoutMs: 10000, intervalSeconds: 60 };

export function SyntheticPage({ currentUser }) {
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const canManage = isSuperAdmin || currentUser?.role === 'client_admin';
    const [clientId, setClientId] = useState(currentUser?.clientId || '');
    const [form, setForm] = useState(initial);
    const [selectedId, setSelectedId] = useState(null);
    const queryClient = useQueryClient();
    const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: clientApi.getClients, enabled: isSuperAdmin });
    const clients = clientsQuery.data?.data || [];
    useEffect(() => { if (isSuperAdmin && !clientId && clients[0]?._id) setClientId(clients[0]._id); }, [clients, clientId, isSuperAdmin]);
    const checksQuery = useQuery({ queryKey: ['synthetics', clientId || 'all'], queryFn: () => syntheticsApi.getChecks(clientId || undefined) });
    const runsQuery = useQuery({ queryKey: ['syntheticRuns', selectedId, clientId], queryFn: () => syntheticsApi.getRuns(selectedId, clientId || undefined), enabled: Boolean(selectedId) });
    const createMutation = useMutation({ mutationFn: () => syntheticsApi.createCheck({ ...form, clientId: clientId || undefined, expectedStatus: Number(form.expectedStatus), timeoutMs: Number(form.timeoutMs), intervalSeconds: Number(form.intervalSeconds) }), onSuccess: () => { setForm(initial); queryClient.invalidateQueries({ queryKey: ['synthetics'] }); } });
    const deleteMutation = useMutation({ mutationFn: (id) => syntheticsApi.deleteCheck(id, clientId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['synthetics'] }) });
    const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
    return <div className={pageStyles.pageContainer}>
        <div className={pageStyles.pageHeader}><div className={pageStyles.headerWithActions}><div><h2>Synthetic Checks</h2><p>Run scheduled API checks before customers discover failures.</p></div>{isSuperAdmin && <label className={pageStyles.clientScope}><span>Client</span><select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">All clients</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label>}</div></div>
        <div className={styles.grid}>{canManage && <Card className={pageStyles.sectionCard}><CardHeader><div className={pageStyles.cardTitleRow}><Globe2 className={pageStyles.cardTitleIcon} /><CardTitle>Create check</CardTitle></div><CardDescription>Checks run from the PlusWatch worker with a hard timeout.</CardDescription></CardHeader><CardContent><form className={styles.form} onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}><label>Name<input value={form.name} onChange={update('name')} placeholder="Public health endpoint" required /></label><label>URL<input type="url" value={form.url} onChange={update('url')} placeholder="https://api.example.com/health" required /></label><div className={styles.row}><label>Method<select value={form.method} onChange={update('method')}><option>GET</option><option>HEAD</option><option>POST</option></select></label><label>Expected status<input type="number" value={form.expectedStatus} onChange={update('expectedStatus')} /></label></div><div className={styles.row}><label>Timeout (ms)<input type="number" value={form.timeoutMs} onChange={update('timeoutMs')} /></label><label>Interval (seconds)<input type="number" value={form.intervalSeconds} onChange={update('intervalSeconds')} /></label></div><button disabled={createMutation.isPending || (isSuperAdmin && !clientId)}><Globe2 size={16} />Create scheduled check</button></form></CardContent></Card>}
            <Card className={pageStyles.sectionCard}><CardHeader><CardTitle>Checks</CardTitle><CardDescription>{checksQuery.data?.data?.length || 0} configured checks</CardDescription></CardHeader><CardContent><div className={styles.list}>{checksQuery.data?.data?.map((check) => <div className={styles.check} key={check.id} onClick={() => setSelectedId(check.id)}><div><strong>{check.name}</strong><span>{check.method} {check.url}</span><small>Every {check.interval_seconds}s · expected {check.expected_status}</small></div>{canManage && <button type="button" title="Delete check" onClick={(event) => { event.stopPropagation(); deleteMutation.mutate(check.id); }}><Trash2 size={15} /></button>}</div>)}</div></CardContent></Card></div>
        {selectedId && <Card className={pageStyles.sectionCard}><CardHeader><CardTitle>Recent runs</CardTitle><CardDescription>Last 50 executions for the selected check</CardDescription></CardHeader><CardContent><div className={styles.list}>{runsQuery.data?.data?.map((run) => <div className={styles.run} key={run.id}><span className={run.success ? styles.pass : styles.fail}>{run.success ? 'PASS' : 'FAIL'}</span><span>{run.status_code || run.error_message}</span><span>{run.latency_ms ? `${run.latency_ms} ms` : ''}</span><time>{new Date(run.checked_at).toLocaleString()}</time></div>)}</div></CardContent></Card>}
    </div>;
}