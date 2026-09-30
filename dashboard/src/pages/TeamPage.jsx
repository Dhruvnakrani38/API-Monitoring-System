import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, UsersRound } from 'lucide-react';
import { clientApi } from '../api/api';

const roleLabels = {
    client_admin: 'Client Admin',
    client_viewer: 'Client Viewer',
};
const fieldStyle = { display: 'grid', gap: '0.35rem', minWidth: 0, color: 'var(--shell-muted)', fontSize: '0.82rem' };
const controlStyle = {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    minHeight: '40px',
    padding: '0.55rem 0.65rem',
    border: '1px solid var(--shell-line)',
    borderRadius: '4px',
    color: 'var(--shell-ink)',
    background: 'var(--shell-panel)',
    font: 'inherit',
};

export function TeamPage({ currentUser }) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ username: '', email: '', password: '', role: 'client_viewer' });
    const clientId = currentUser?.clientId;
    const queryKey = ['clientUsers', clientId];
    const { data, isLoading, error } = useQuery({
        queryKey,
        queryFn: () => clientApi.getClientUsers(clientId),
        enabled: Boolean(clientId),
    });
    const createMutation = useMutation({
        mutationFn: (userData) => clientApi.createClientUser(clientId, userData),
        onSuccess: () => {
            setForm({ username: '', email: '', password: '', role: 'client_viewer' });
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const users = data?.data || [];
    const updateField = (event) => setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));

    return (
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <UsersRound aria-hidden="true" />
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Team</h1>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.72 }}>Manage members in your client workspace.</p>
                </div>
            </header>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    createMutation.mutate(form);
                }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end', marginBottom: '2rem' }}
            >
                <label style={fieldStyle}>Username
                    <input style={controlStyle} name="username" value={form.username} onChange={updateField} minLength={3} required autoComplete="off" />
                </label>
                <label style={fieldStyle}>Email
                    <input style={controlStyle} name="email" type="email" value={form.email} onChange={updateField} required autoComplete="email" />
                </label>
                <label style={fieldStyle}>Temporary password
                    <input style={controlStyle} name="password" type="password" value={form.password} onChange={updateField} minLength={8} pattern="(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}" title="Use at least 8 characters with uppercase, lowercase, a number, and a symbol." required autoComplete="new-password" />
                </label>
                <label style={fieldStyle}>Role
                    <select style={controlStyle} name="role" value={form.role} onChange={updateField}>
                        <option value="client_viewer">Client Viewer</option>
                        <option value="client_admin">Client Admin</option>
                    </select>
                </label>
                <button type="submit" disabled={createMutation.isPending || !clientId} style={{ minHeight: '40px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.8rem', border: 0, borderRadius: '4px', color: '#17200f', background: 'var(--shell-accent)', fontWeight: 700, cursor: 'pointer' }}>
                    <UserPlus aria-hidden="true" size={16} />
                    {createMutation.isPending ? 'Adding…' : 'Add user'}
                </button>
            </form>
            <p style={{ marginTop: '-1.5rem', marginBottom: '1.5rem', opacity: 0.72, fontSize: '0.82rem' }}>
                Passwords require at least 8 characters, including uppercase, lowercase, a number, and a symbol.
            </p>
            {createMutation.isError && <p role="alert">Could not add user: {createMutation.error.response?.data?.message || createMutation.error.message}</p>}
            {createMutation.isSuccess && <p role="status">User added and can sign in now.</p>}
            {error && <p role="alert">Could not load client users: {error.message}</p>}

            <div aria-live="polite">
                {isLoading ? <p>Loading team…</p> : users.map((user) => (
                    <article key={user._id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '1rem 0.25rem', borderTop: '1px solid currentColor' }}>
                        <div>
                            <strong>{user.username}</strong>
                            <div style={{ opacity: 0.72 }}>{user.email}</div>
                        </div>
                        <span>{roleLabels[user.role] || user.role}</span>
                    </article>
                ))}
                {!isLoading && !error && users.length === 0 && <p>No team members found.</p>}
            </div>
        </section>
    );
}
