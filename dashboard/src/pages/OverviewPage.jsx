import { useEffect, useMemo, useState } from 'react';
import { useDashboardQuery } from '../hooks/useDashboardQuery';
import { useQuery } from '@tanstack/react-query';
import { clientApi, analyticsApi } from '../api/api';
import { AlertCircle, CheckCircle2, Clock3, X } from 'lucide-react';
import StatsGrid from '../components/StatsGrid';
import TopEndpoints from '../components/TopEndpoints';
import { ApiHitsChart, StatusDistributionChart } from '../components/charts';
import { PageStatus } from '../components/ui';
import styles from '../styles/modules/pages/PageComponents.module.scss';

// Ye page fetched analytics ko summary, charts aur endpoint table mein dikhata hai.
export function OverviewPage({ currentUser }) {
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedEndpoint, setSelectedEndpoint] = useState(null);
    const [detailStartDate, setDetailStartDate] = useState('');
    const [detailEndDate, setDetailEndDate] = useState('');
    const clientsQuery = useQuery({
        queryKey: ['clients'],
        queryFn: clientApi.getClients,
        enabled: isSuperAdmin,
    });
    const clients = clientsQuery.data?.data || [];

    useEffect(() => {
        if (!isSuperAdmin) setSelectedClientId('');
    }, [isSuperAdmin]);

    const { data, isPending, error, refetch } = useDashboardQuery({ clientId: selectedClientId || undefined });
    const detailQuery = useQuery({
        queryKey: ['endpointDetails', selectedClientId, selectedEndpoint?.serviceName, selectedEndpoint?.endpoint, selectedEndpoint?.method, detailStartDate, detailEndDate],
        queryFn: () => analyticsApi.getEndpointDetails({
            clientId: selectedClientId || undefined,
            serviceName: selectedEndpoint.serviceName,
            endpoint: selectedEndpoint.endpoint,
            method: selectedEndpoint.method,
            startTime: detailStartDate ? new Date(`${detailStartDate}T00:00:00`).toISOString() : undefined,
            endTime: detailEndDate ? new Date(`${detailEndDate}T23:59:59.999`).toISOString() : undefined,
        }),
        enabled: Boolean(selectedEndpoint && (!isSuperAdmin || selectedClientId)),
    });

    const stats = data?.data?.stats ?? null;
    const topEndpoints = data?.data?.topEndpoints ?? [];

    // Summary counts ko status chart ke labels aur values mein badlo.
    const statusData = useMemo(() => {
        if (!stats) return null;
        return {
            labels: ['Success (2xx)', 'Errors (4xx/5xx)'],
            values: [stats.successHits, stats.errorHits],
        };
    }, [stats]);

    if (isPending || error || !data) {
        return (
            <PageStatus
                isLoading={isPending || !data}
                error={error}
                onRetry={refetch}
                loadingText="Loading dashboard..."
                errorText="Failed to load dashboard data"
            />
        );
    }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.pageHeader}>
                <div className={styles.headerWithActions}>
                    <div>
                        <h2>Overview</h2>
                        <p>Welcome to your API monitoring dashboard</p>
                    </div>
                    {isSuperAdmin && (
                        <label className={styles.clientScope}>
                            <span>Watching</span>
                            <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                                <option value="">All clients</option>
                                {clients.map((client) => (
                                    <option key={client._id} value={client._id}>{client.name}</option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>
            </div>

            <StatsGrid stats={stats} />

            <div className={styles.gridTwoCols}>
                <ApiHitsChart stats={stats} />
                <StatusDistributionChart data={statusData} />
            </div>

            <TopEndpoints
                endpoints={topEndpoints}
                onSelectEndpoint={setSelectedEndpoint}
                canOpenDetails={!isSuperAdmin || Boolean(selectedClientId)}
            />

            {selectedEndpoint && (
                <div className={styles.detailOverlay} role="presentation" onClick={() => setSelectedEndpoint(null)}>
                    <aside className={styles.detailDrawer} role="dialog" aria-modal="true" aria-labelledby="endpoint-detail-title" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.detailHeader}>
                            <div>
                                <p className={styles.detailEyebrow}>ENDPOINT DETAIL</p>
                                <h3 id="endpoint-detail-title">{selectedEndpoint.method} {selectedEndpoint.endpoint}</h3>
                                <p>{selectedEndpoint.serviceName}</p>
                            </div>
                            <button type="button" className={styles.detailClose} onClick={() => setSelectedEndpoint(null)} aria-label="Close endpoint details">
                                <X aria-hidden="true" />
                            </button>
                        </div>
                        {detailQuery.isPending && <p className={styles.detailStatus}>Loading endpoint details…</p>}
                        {detailQuery.isError && <p className={styles.detailError}>Unable to load endpoint details.</p>}
                        {detailQuery.data?.data && (
                            <div className={styles.detailBody}>
                                <div className={styles.detailFilters}>
                                    <label>From<input type="date" value={detailStartDate} onChange={(event) => setDetailStartDate(event.target.value)} /></label>
                                    <label>To<input type="date" value={detailEndDate} onChange={(event) => setDetailEndDate(event.target.value)} /></label>
                                </div>
                                <div className={styles.detailMetrics}>
                                    <div><strong>{detailQuery.data.data.summary.totalRequests.toLocaleString()}</strong><span>Total requests</span></div>
                                    <div><strong>{detailQuery.data.data.summary.successfulRequests.toLocaleString()}</strong><span>Successful</span></div>
                                    <div><strong>{detailQuery.data.data.summary.failedRequests.toLocaleString()}</strong><span>Failed</span></div>
                                    <div><strong>{detailQuery.data.data.summary.failureRate}%</strong><span>Failure rate</span></div>
                                </div>
                                <div className={styles.detailSection}>
                                    <h4>Latency</h4>
                                    <div className={styles.latencyStats}><span><Clock3 /> Avg <b>{detailQuery.data.data.summary.averageLatency} ms</b></span><span>Min <b>{detailQuery.data.data.summary.minimumLatency} ms</b></span><span>Max <b>{detailQuery.data.data.summary.maximumLatency} ms</b></span></div>
                                </div>
                                <div className={styles.detailSection}>
                                    <h4>HTTP status breakdown</h4>
                                    <div className={styles.statusList}>
                                        {detailQuery.data.data.statusBreakdown.map((status) => <div key={status.statusCode}><span className={status.statusCode >= 400 ? styles.statusFailure : styles.statusSuccess}>{status.statusCode}</span><b>{status.count.toLocaleString()}</b></div>)}
                                    </div>
                                </div>
                                <div className={styles.detailSection}>
                                    <h4><AlertCircle /> Recent failures</h4>
                                    {detailQuery.data.data.recentFailures.length === 0 ? <p className={styles.detailStatus}><CheckCircle2 /> No failed requests in this range.</p> : <div className={styles.failureList}>{detailQuery.data.data.recentFailures.map((failure, index) => <div key={`${failure.timestamp}-${index}`}><span className={styles.statusFailure}>{failure.statusCode}</span><span>{failure.method}</span><time>{new Date(failure.timestamp).toLocaleString()}</time><b>{failure.latencyMs} ms</b></div>)}</div>}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
}
