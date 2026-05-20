import React, { useEffect, useState } from 'react';
import { getOverviewStats } from '../../api/Admin/AdminApi';

const roleLabelMap = { teacher: 'Tanár', student: 'Diák', parent: 'Szülő', admin: 'Admin' };
const roleBadgeMap = { teacher: 'admin-badge-teacher', student: 'admin-badge-student', parent: 'admin-badge-parent', admin: 'admin-badge-admin' };

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        getOverviewStats()
            .then(setStats)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="admin-loading">
            <div className="admin-spinner" />
            <span>Adatok betöltése...</span>
        </div>
    );

    if (error) return (
        <div className="admin-card">
            <p style={{ color: '#f87171', textAlign: 'center' }}>⚠️ {error}</p>
        </div>
    );

    const statCards = [
        {
            icon: '👥',
            value: stats.users.total,
            label: 'Összes felhasználó',
            color: 'linear-gradient(90deg, #3b82f6, #6366f1)',
            sub: `+${stats.newRegistrations?.last30 || 0} az elmúlt 30 napban`,
            subClass: 'positive',
        },
        {
            icon: '🎓',
            value: stats.users.teacher,
            label: 'Tanárok',
            color: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
        },
        {
            icon: '🧑‍🎓',
            value: stats.users.student,
            label: 'Diákok',
            color: 'linear-gradient(90deg, #10b981, #059669)',
        },
        {
            icon: '👨‍👩‍👦',
            value: stats.users.parent,
            label: 'Szülők',
            color: 'linear-gradient(90deg, #f59e0b, #d97706)',
        },
        {
            icon: '📝',
            value: stats.assignmentCount,
            label: 'Összes feladat',
            color: 'linear-gradient(90deg, #0ea5e9, #0284c7)',
        },
        {
            icon: '💰',
            value: `$${(stats.monthlyCost || 0).toFixed(4)}`,
            label: 'Havi AI költség',
            color: 'linear-gradient(90deg, #f43f5e, #e11d48)',
        },
    ];

    return (
        <>
            <div className="admin-page-header">
                <h2 className="admin-page-title">Áttekintés</h2>
                <p className="admin-page-subtitle">A rendszer aktuális állapota és legfontosabb mutatói</p>
            </div>

            <div className="admin-stats-grid">
                {statCards.map((card, i) => (
                    <div key={i} className="admin-stat-card" style={{ '--card-color': card.color }}>
                        <div className="admin-stat-icon">{card.icon}</div>
                        <div className="admin-stat-value">{card.value}</div>
                        <div className="admin-stat-label">{card.label}</div>
                        {card.sub && (
                            <div className={`admin-stat-change ${card.subClass || ''}`}>{card.sub}</div>
                        )}
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">👤 Legutóbbi regisztrációk</h3>
                    </div>
                    {stats.recentUsers?.length ? (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Név</th>
                                        <th>Email</th>
                                        <th>Szerep</th>
                                        <th>Regisztráció</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentUsers.map(u => (
                                        <tr key={u._id}>
                                            <td style={{ fontWeight: 500, color: '#e2e8f0' }}>{u.name}</td>
                                            <td style={{ color: '#64748b', fontSize: '12px' }}>{u.email}</td>
                                            <td>
                                                <span className={`admin-badge ${roleBadgeMap[u.role] || ''}`}>
                                                    {roleLabelMap[u.role] || u.role}
                                                </span>
                                            </td>
                                            <td style={{ color: '#64748b', fontSize: '12px' }}>
                                                {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="admin-empty">
                            <div className="admin-empty-icon">👤</div>
                            <p className="admin-empty-text">Még nincs regisztrált felhasználó</p>
                        </div>
                    )}
                </div>

                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">📊 Szerepkör megoszlás</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                            { role: 'teacher', count: stats.users.teacher, color: '#6366f1' },
                            { role: 'student', count: stats.users.student, color: '#10b981' },
                            { role: 'parent', count: stats.users.parent, color: '#f59e0b' },
                        ].map(item => {
                            const pct = stats.users.total > 0 ? Math.round((item.count / stats.users.total) * 100) : 0;
                            return (
                                <div key={item.role}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>{roleLabelMap[item.role]}</span>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{item.count} ({pct}%)</span>
                                    </div>
                                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            background: item.color,
                                            borderRadius: '4px',
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', color: '#64748b' }}>Új regisztrációk (7 nap)</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#4ade80' }}>
                                +{stats.newRegistrations?.last7 || 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminDashboard;
