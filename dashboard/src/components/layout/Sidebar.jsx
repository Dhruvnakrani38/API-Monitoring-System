import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
    Activity,
    BellRing,
    LayoutDashboard,
    Settings,
    ShieldCheck,
    UsersRound,
} from 'lucide-react';
import styles from '../../styles/modules/layout/Sidebar.module.scss';

const navItems = [
    {
        title: 'Overview',
        href: '/',
        icon: LayoutDashboard,
        description: 'Main dashboard view'
    },
    {
        title: 'User Approvals',
        href: '/approvals',
        icon: ShieldCheck,
        description: 'Approve client registrations'
    },
    {
        title: 'Alerts',
        href: '/alerts',
        icon: BellRing,
        description: 'Alert rules and incidents',
    },
];

const bottomNavItems = [
    {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
        description: 'App settings'
    },
];

// Ye component app ke main routes ko responsive sidebar mein dikhata hai.
export function Sidebar({ isOpen, onClose, currentUser }) {
    const visibleNavItems = [
        ...navItems.filter((item) => item.href !== '/approvals' || currentUser?.role === 'super_admin'),
        ...(currentUser?.role === 'client_admin' ? [{
            title: 'Team',
            href: '/team',
            icon: UsersRound,
            description: 'Manage client users',
        }] : []),
    ];

    return (
        <>
            {isOpen && (
                <div
                    className={styles.mobileOverlay}
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            <aside
                className={cn(styles.sidebar, !isOpen && styles.closed)}
                aria-label="Sidebar"
                aria-expanded={isOpen}
            >
                <div className={styles.sidebarContainer}>
                    <div className={styles.logoSection}>
                        <div className={styles.logoIcon}>
                            <Activity aria-hidden="true" />
                        </div>
                        <div className={styles.logoText}>
                            <h2>PlusWatch</h2>
                            <p>by DN Systems</p>
                        </div>
                    </div>
                    <nav className={styles.navigation} aria-label="Main navigation">
                        <div className={styles.navList}>
                            {/* Har main route ke liye icon aur active-state link banao. */}
                            {visibleNavItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <NavLink
                                        key={item.href}
                                        to={item.href}
                                        end={item.href === '/'}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            cn(styles.navLink, isActive && styles.active)
                                        }
                                    >
                                        <Icon aria-hidden="true" />
                                        <div className={styles.navItem}>
                                            <div>{item.title}</div>
                                        </div>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </nav>
                    <div className={styles.bottomNavigation}>
                        {/* Secondary pages ko sidebar ke neeche alag rakho. */}
                        {bottomNavItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.href}
                                    to={item.href}
                                    onClick={onClose}
                                    className={({ isActive }) =>
                                        cn(styles.navLink, isActive && styles.active)
                                    }
                                >
                                    <Icon aria-hidden="true" />
                                    <div className={styles.navItem}>
                                        <div>{item.title}</div>
                                    </div>
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            </aside>
        </>
    );
}
