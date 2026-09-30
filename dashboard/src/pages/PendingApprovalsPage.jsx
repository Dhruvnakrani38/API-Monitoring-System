import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, clientApi } from '../api/api';
import { CheckCircle2, XCircle, Clock, ShieldCheck, Key, Copy, Check } from 'lucide-react';

// Ye page pending registrations ko load karke approve ya reject karne deta hai.
export function PendingApprovalsPage() {
    const queryClient = useQueryClient();
    const [approvalResult, setApprovalResult] = useState(null);
    const [copiedKey, setCopiedKey] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState({});
    const [selectedClients, setSelectedClients] = useState({});

    // Server se pending registrations mangao aur loading/error state sambhalo.
    const { data: pendingUsersResponse, isLoading, error } = useQuery({
        queryKey: ['pendingUsers'],
        queryFn: authApi.getPendingUsers,
    });
    const { data: clientsResponse } = useQuery({
        queryKey: ['clients'],
        queryFn: clientApi.getClients,
    });

    // Approval ke baad list refresh karo aur naya client/API key dikhaye.
    const approveMutation = useMutation({
        mutationFn: ({ userId, role, clientId }) => authApi.approveUser(userId, role, clientId),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
            if (response.data) {
                setApprovalResult(response.data);
            }
        },
    });

    // Rejection ke baad pending-users query ko dobara fetch karwao.
    const rejectMutation = useMutation({
        mutationFn: authApi.rejectUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
        },
    });

    const pendingUsers = pendingUsersResponse?.data || [];
    const clients = clientsResponse?.data || [];

    // Generated API key clipboard mein copy karke temporary feedback dikhata hai.
    const handleCopyKey = (key) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck style={{ width: 32, height: 32, color: 'var(--accent-color, #6366f1)' }} />
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #f8fafc)' }}>
                        User Approvals
                    </h1>
                    <p style={{ color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
                        Review and approve client registration requests
                    </p>
                </div>
            </div>

            {approvalResult && (
                <div style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    color: '#4ade80'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <CheckCircle2 style={{ width: 24, height: 24 }} />
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                                User Approved Successfully
                        </h3>
                    </div>
                    <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-primary, #f8fafc)' }}>
                        <strong>Client:</strong> {approvalResult.client?.name}
                    </p>
                    <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary, #94a3b8)', overflowWrap: 'anywhere' }}>
                        {approvalResult.client?.email} · {approvalResult.client?.slug}
                        {!approvalResult.apiKey && ' · Existing client; no new API key was created'}
                    </p>
                    <p style={{ margin: '0 0 1rem 0', color: 'var(--text-primary, #f8fafc)' }}>
                        <strong>User:</strong> {approvalResult.user?.username} ({approvalResult.user?.email})
                    </p>
                    {approvalResult.apiKey && (
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                <Key style={{ width: 20, height: 20, color: '#fbbf24', flexShrink: 0 }} />
                                <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#f8fafc' }}>
                                    {approvalResult.apiKey.keyValue || approvalResult.apiKey}
                                </span>
                            </div>
                            <button
                                onClick={() => handleCopyKey(approvalResult.apiKey.keyValue || approvalResult.apiKey)}
                                style={{
                                    background: 'var(--accent-color, #6366f1)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.375rem',
                                    fontSize: '0.85rem'
                                }}
                            >
                                {copiedKey ? <Check style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
                                {copiedKey ? 'Copied' : 'Copy Key'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {isLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary, #94a3b8)' }}>
                    Loading pending approval requests…
                </div>
            ) : error ? (
                <div style={{ padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.75rem', color: '#f87171' }}>
                    Failed to load pending users: {error.message}
                </div>
            ) : pendingUsers.length === 0 ? (
                <div style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    background: 'var(--card-bg, rgba(30, 41, 59, 0.5))',
                    borderRadius: '1rem',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.05))'
                }}>
                    <Clock style={{ width: 48, height: 48, color: 'var(--text-secondary, #94a3b8)', marginBottom: '1rem', opacity: 0.5 }} />
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary, #f8fafc)' }}>
                        No Pending Registration Requests
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary, #94a3b8)' }}>
                        All client signup requests have been processed.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {/* Har pending account ke liye review aur action row banao. */}
                    {pendingUsers.map((user) => (
                        <div
                            key={user._id || user.id}
                            style={{
                                background: 'var(--card-bg, rgba(30, 41, 59, 0.7))',
                                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                                borderRadius: '0.75rem',
                                padding: '1.25rem 1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '1rem'
                            }}
                        >
                            <div>
                                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--text-primary, #f8fafc)' }}>
                                    {user.username}
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>
                                    {user.email} &bull; Requested: {new Date(user.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem' }}>
                                    Assign client
                                    <select
                                        value={selectedClients[user._id || user.id] || ''}
                                        onChange={(event) => setSelectedClients((prev) => ({
                                            ...prev,
                                            [user._id || user.id]: event.target.value,
                                        }))}
                                        style={{
                                            maxWidth: '220px',
                                            background: 'rgba(15, 23, 42, 0.85)',
                                            color: 'var(--text-primary, #f8fafc)',
                                            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                                            borderRadius: '0.5rem',
                                            padding: '0.45rem 0.75rem',
                                        }}
                                    >
                                        <option value="">Create new client</option>
                                        {clients.map((client) => (
                                            <option key={client._id} value={client._id}>{client.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem' }}>
                                    Role
                                    <select
                                        value={selectedRoles[user._id || user.id] || 'client_viewer'}
                                        onChange={(event) => setSelectedRoles((prev) => ({
                                            ...prev,
                                            [user._id || user.id]: event.target.value,
                                        }))}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.85)',
                                            color: 'var(--text-primary, #f8fafc)',
                                            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                                            borderRadius: '0.5rem',
                                            padding: '0.45rem 0.75rem',
                                        }}
                                    >
                                        <option value="client_viewer">Client Viewer</option>
                                        <option value="client_admin">Client Admin</option>
                                    </select>
                                </label>
                                <button
                                    onClick={() => rejectMutation.mutate(user._id || user.id)}
                                    disabled={rejectMutation.isPending}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#f87171',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        fontWeight: 600
                                    }}
                                >
                                    <XCircle style={{ width: 18, height: 18 }} />
                                    Reject
                                </button>
                                <button
                                    onClick={() => approveMutation.mutate({
                                        userId: user._id || user.id,
                                        role: selectedRoles[user._id || user.id] || 'client_viewer',
                                        clientId: selectedClients[user._id || user.id] || null,
                                    })}
                                    disabled={approveMutation.isPending}
                                    style={{
                                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '0.5rem 1.25rem',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        fontWeight: 600,
                                        boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                                    }}
                                >
                                    <CheckCircle2 style={{ width: 18, height: 18 }} />
                                    Approve & Generate Key
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default PendingApprovalsPage;
