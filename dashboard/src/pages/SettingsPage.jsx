import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui';
import { ThemeSelector } from '../components/ThemeSelector';
import { Check, Copy, Eye, EyeOff, KeyRound, Palette, ShieldCheck, UserRound } from 'lucide-react';
import { clientApi } from '../api/api';
import styles from '../styles/modules/pages/PageComponents.module.scss';
import accountStyles from '../styles/modules/pages/Settings.module.scss';

const roleNames = {
    super_admin: 'Super Admin',
    client_admin: 'Client Admin',
    client_viewer: 'Client Viewer',
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not available';

export function SettingsPage({ currentUser }) {
    const [selectedClientId, setSelectedClientId] = useState(currentUser?.clientId || '');
    const [password, setPassword] = useState('');
    const [revealedKeys, setRevealedKeys] = useState(null);
    const [copiedKeyId, setCopiedKeyId] = useState(null);
    const isSuperAdmin = currentUser?.role === 'super_admin';
    const canRevealKeys = isSuperAdmin || currentUser?.role === 'client_admin';
    const clientsQuery = useQuery({
        queryKey: ['clients'],
        queryFn: clientApi.getClients,
        enabled: isSuperAdmin,
    });
    const clients = clientsQuery.data?.data || [];
    const activeClientId = isSuperAdmin ? selectedClientId : currentUser?.clientId;

    useEffect(() => {
        if (isSuperAdmin && !selectedClientId && clients.length > 0) {
            setSelectedClientId(clients[0]._id);
        }
    }, [clients, isSuperAdmin, selectedClientId]);

    const revealMutation = useMutation({
        mutationFn: () => clientApi.revealClientApiKeys(activeClientId, password),
        onSuccess: (response) => {
            setRevealedKeys(response.data || []);
            setPassword('');
        },
    });

    const copyKey = async (key) => {
        await navigator.clipboard.writeText(key.keyValue);
        setCopiedKeyId(key.keyId);
        window.setTimeout(() => setCopiedKeyId(null), 1600);
    };

    const hideKeys = () => {
        setRevealedKeys(null);
        revealMutation.reset();
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.pageHeader}>
                <h2>Profile & Settings</h2>
                <p>Your account, client access, and preferences</p>
            </div>

            <div className={accountStyles.profileGrid}>
                <Card className={styles.sectionCard}>
                    <CardHeader>
                        <div className={styles.cardTitleRow}>
                            <UserRound className={styles.cardTitleIcon} aria-hidden="true" />
                            <CardTitle>Account profile</CardTitle>
                        </div>
                        <CardDescription>Signed-in account details and access role</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <dl className={accountStyles.detailsList}>
                            <div><dt>Username</dt><dd>{currentUser?.username || 'Not available'}</dd></div>
                            <div><dt>Email</dt><dd>{currentUser?.email || 'Not available'}</dd></div>
                            <div><dt>Role</dt><dd>{roleNames[currentUser?.role] || currentUser?.role || 'Not available'}</dd></div>
                            <div><dt>Account status</dt><dd>{currentUser?.isActive ? 'Active' : 'Inactive'}</dd></div>
                            <div><dt>Approved / added by</dt><dd>{currentUser?.approvedByUser?.username || (currentUser?.role === 'super_admin' ? 'Initial administrator' : 'Not available')}</dd></div>
                            <div><dt>Joined</dt><dd>{formatDate(currentUser?.createdAt)}</dd></div>
                        </dl>
                    </CardContent>
                </Card>

                <Card className={styles.sectionCard}>
                    <CardHeader>
                        <div className={styles.cardTitleRow}>
                            <ShieldCheck className={styles.cardTitleIcon} aria-hidden="true" />
                            <CardTitle>Client profile</CardTitle>
                        </div>
                        <CardDescription>Workspace assigned to this account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {currentUser?.client ? (
                            <dl className={accountStyles.detailsList}>
                                <div><dt>Client</dt><dd>{currentUser.client.name}</dd></div>
                                <div><dt>Client email</dt><dd>{currentUser.client.email}</dd></div>
                                <div><dt>Workspace slug</dt><dd>{currentUser.client.slug}</dd></div>
                                <div><dt>Description</dt><dd>{currentUser.client.description || 'No description'}</dd></div>
                                <div><dt>Client created by</dt><dd>{currentUser.client.createdBy?.username || 'Not available'}</dd></div>
                                <div><dt>Client created</dt><dd>{formatDate(currentUser.client.createdAt)}</dd></div>
                            </dl>
                        ) : (
                            <p className={accountStyles.emptyNote}>This account is not assigned to a client workspace.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {canRevealKeys && (
                <Card className={styles.sectionCard}>
                    <CardHeader>
                        <div className={styles.cardTitleRow}>
                            <KeyRound className={styles.cardTitleIcon} aria-hidden="true" />
                            <CardTitle>Client API keys</CardTitle>
                        </div>
                        <CardDescription>Key values stay hidden until you verify your password.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isSuperAdmin && (
                            <label className={accountStyles.clientSelect}>
                                Client workspace
                                <select value={selectedClientId} onChange={(event) => {
                                    setSelectedClientId(event.target.value);
                                    setRevealedKeys(null);
                                    revealMutation.reset();
                                }}>
                                    {clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
                                </select>
                            </label>
                        )}
                        <form className={accountStyles.revealForm} onSubmit={(event) => {
                            event.preventDefault();
                            setRevealedKeys(null);
                            revealMutation.mutate();
                        }}>
                            <label className={accountStyles.passwordField}>
                                Confirm your password
                                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                            </label>
                            <button type="submit" disabled={!activeClientId || revealMutation.isPending}>
                                <Eye aria-hidden="true" size={16} />
                                {revealMutation.isPending ? 'Verifying…' : 'Verify and reveal'}
                            </button>
                        </form>
                        {revealMutation.isError && <p className={accountStyles.errorText} role="alert">{revealMutation.error.response?.data?.message || 'Password verification failed.'}</p>}
                        {revealedKeys && (
                            <div className={accountStyles.keyList}>
                                <div className={accountStyles.keyListHeader}>
                                    <strong>Active keys</strong>
                                    <button type="button" className={accountStyles.hideButton} onClick={hideKeys}><EyeOff aria-hidden="true" size={15} /> Hide values</button>
                                </div>
                                {revealedKeys.length === 0 ? <p className={accountStyles.emptyNote}>No active API keys for this client.</p> : revealedKeys.map((key) => (
                                    <div className={accountStyles.keyRow} key={key.keyId}>
                                        <div><strong>{key.name}</strong><code>{key.keyValue}</code></div>
                                        <button type="button" className={accountStyles.copyButton} aria-label={`Copy ${key.name}`} title="Copy API key" onClick={() => copyKey(key)}>
                                            {copiedKeyId === key.keyId ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card className={styles.sectionCard}>
                <CardHeader>
                    <div className={styles.cardTitleRow}>
                        <Palette className={styles.cardTitleIcon} aria-hidden="true" />
                        <CardTitle>Appearance</CardTitle>
                    </div>
                    <CardDescription>Customize the look and feel of your dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                    <ThemeSelector />
                </CardContent>
            </Card>
        </div>
    );
}
