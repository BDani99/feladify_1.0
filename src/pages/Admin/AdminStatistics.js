import React, { useEffect, useState } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { getActivityStats, getAssignmentStats } from '../../api/Admin/AdminApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const ROLE_LABELS = { teacher: 'Tanár', student: 'Diák', parent: 'Szülő' };
const ROLE_COLORS = { teacher: 'rgba(99,102,241,0.8)', student: 'rgba(16,185,129,0.8)', parent: 'rgba(245,158,11,0.8)' };

const AdminStatistics = () => {
    const [activity, setActivity] = useState(null);
    const [assignments, setAssignments] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([getActivityStats(), getAssignmentStats()])
            .then(([a, b]) => { setActivity(a); setAssignments(b); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="admin-loading"><div className="admin-spinner" /><span>Adatok betöltése...</span></div>;
    if (error) return <div className="admin-card"><p style={{ color: '#f87171', textAlign: 'center' }}>⚠️ {error}</p></div>;

    const regDays = activity?.registrationsByDay || [];
    const registrationChart = {
        labels: regDays.map(d => d._id),
        datasets: [{
            label: 'Regisztrációk',
            data: regDays.map(d => d.count),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.12)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
        }],
    };

    const roleData = activity?.roleDistribution || [];
    const roleLabels = roleData.map(r => ROLE_LABELS[r._id] || r._id);
    const roleColors = roleData.map(r => ROLE_COLORS[r._id] || '#64748b');
    const roleChart = {
        labels: roleLabels,
        datasets: [{
            data: roleData.map(r => r.count),
            backgroundColor: roleColors,
            borderColor: roleColors.map(c => c.replace('0.8', '1')),
            borderWidth: 2,
        }],
    };

    const subjData = assignments?.bySubject || [];
    const subjectChart = {
        labels: subjData.map(s => s._id),
        datasets: [{
            label: 'Feladatok száma',
            data: subjData.map(s => s.count),
            backgroundColor: 'rgba(99,102,241,0.65)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6,
        }],
    };

    const lineOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1 } },
        scales: {
            x: { ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
        },
    };

    const barOptions = {
        ...lineOptions,
        scales: {
            ...lineOptions.scales,
            x: { ...lineOptions.scales.x, ticks: { ...lineOptions.scales.x.ticks, maxRotation: 30 } },
        },
    };

    const doughnutOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 13 }, padding: 16 } },
            tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1 },
        },
    };

    return (
        <>
            <div className="admin-page-header">
                <h2 className="admin-page-title">Statisztikák</h2>
                <p className="admin-page-subtitle">Felhasználói aktivitás és platform használati adatok</p>
            </div>

            <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[
                    { icon: '📝', value: assignments?.total || 0, label: 'Összes feladat', color: 'linear-gradient(90deg,#3b82f6,#6366f1)' },
                    { icon: '✅', value: assignments?.submittedCount || 0, label: 'Beküldött megoldás', color: 'linear-gradient(90deg,#10b981,#059669)' },
                    { icon: '⭐', value: assignments?.avgGrade ? assignments.avgGrade.toFixed(1) : '—', label: 'Átlagjegy', color: 'linear-gradient(90deg,#f59e0b,#d97706)' },
                    { icon: '📚', value: subjData.length, label: 'Aktív tantárgy', color: 'linear-gradient(90deg,#8b5cf6,#7c3aed)' },
                ].map((c, i) => (
                    <div key={i} className="admin-stat-card" style={{ '--card-color': c.color }}>
                        <div className="admin-stat-icon">{c.icon}</div>
                        <div className="admin-stat-value">{c.value}</div>
                        <div className="admin-stat-label">{c.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">📈 Regisztrációk (utolsó 30 nap)</h3>
                    </div>
                    {regDays.length > 0 ? (
                        <div className="admin-chart-container">
                            <Line data={registrationChart} options={lineOptions} />
                        </div>
                    ) : (
                        <div className="admin-empty"><p className="admin-empty-text">Nincs adat az elmúlt 30 napból</p></div>
                    )}
                </div>

                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">🥧 Szerepkör megoszlás</h3>
                    </div>
                    {roleData.length > 0 ? (
                        <div className="admin-chart-container">
                            <Doughnut data={roleChart} options={doughnutOptions} />
                        </div>
                    ) : (
                        <div className="admin-empty"><p className="admin-empty-text">Nincs adat</p></div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">📊 Tantárgyak szerinti feladatok</h3>
                    </div>
                    {subjData.length > 0 ? (
                        <div className="admin-chart-container">
                            <Bar data={subjectChart} options={barOptions} />
                        </div>
                    ) : (
                        <div className="admin-empty"><p className="admin-empty-text">Nincs feladat adat</p></div>
                    )}
                </div>

                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">👤 Legutóbbi regisztrálók</h3>
                    </div>
                    {activity?.recentUsers?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {activity.recentUsers.slice(0, 8).map(u => (
                                <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#60a5fa' }}>
                                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{u.name}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className={`admin-badge admin-badge-${u.role}`} style={{ fontSize: '11px' }}>
                                            {ROLE_LABELS[u.role] || u.role}
                                        </span>
                                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                                            {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="admin-empty"><p className="admin-empty-text">Nincs adat</p></div>
                    )}
                </div>
            </div>
        </>
    );
};

export default AdminStatistics;
