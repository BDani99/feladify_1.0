import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale,
    BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { getCostStats } from '../../api/Admin/AdminApi';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(15,23,42,0.95)',
            borderColor: 'rgba(59,130,246,0.3)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            callbacks: {
                label: ctx => ` $${ctx.raw.toFixed(6)}`,
            },
        },
    },
    scales: {
        x: {
            ticks: { color: '#64748b', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
            ticks: { color: '#64748b', font: { size: 11 }, callback: v => `$${v.toFixed(4)}` },
            grid: { color: 'rgba(255,255,255,0.06)' },
        },
    },
};

const makeChartData = (obj, label) => {
    const entries = Object.entries(obj || {})
        .map(([k, v]) => ({ key: k, cost: v?.totalCostUSD || v || 0 }))
        .sort((a, b) => b.cost - a.cost);
    return {
        labels: entries.map(e => e.key),
        datasets: [{
            label,
            data: entries.map(e => e.cost),
            backgroundColor: 'rgba(59,130,246,0.6)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 6,
        }],
        raw: entries,
    };
};

const AdminCosts = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        getCostStats()
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="admin-loading"><div className="admin-spinner" /><span>Adatok betöltése...</span></div>;
    if (error) return <div className="admin-card"><p style={{ color: '#f87171', textAlign: 'center' }}>⚠️ {error}</p></div>;
    if (!data || !data.month) return (
        <div className="admin-card">
            <div className="admin-empty"><div className="admin-empty-icon">💰</div><p className="admin-empty-text">Még nincsenek cost adatok.</p></div>
        </div>
    );

    const modelChart = makeChartData(data.byModel, 'Modell');
    const chainChart = makeChartData(data.byChain, 'Funkció');

    const userEntries = Object.entries(data.byUser || {})
        .map(([id, u]) => ({ id, ...u }))
        .sort((a, b) => (b.totalCostUSD || 0) - (a.totalCostUSD || 0))
        .slice(0, 15);

    return (
        <>
            <div className="admin-page-header">
                <h2 className="admin-page-title">AI Költségek</h2>
                <p className="admin-page-subtitle">Havi AI API felhasználás és költségek részletes áttekintése</p>
            </div>

            <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="admin-stat-card" style={{ '--card-color': 'linear-gradient(90deg,#f43f5e,#e11d48)' }}>
                    <div className="admin-stat-icon">💰</div>
                    <div className="admin-stat-value">${(data.totalCostUSD || 0).toFixed(4)}</div>
                    <div className="admin-stat-label">Összes havi költség</div>
                </div>
                <div className="admin-stat-card" style={{ '--card-color': 'linear-gradient(90deg,#3b82f6,#6366f1)' }}>
                    <div className="admin-stat-icon">📞</div>
                    <div className="admin-stat-value">{data.callCount || 0}</div>
                    <div className="admin-stat-label">API hívások száma</div>
                </div>
                <div className="admin-stat-card" style={{ '--card-color': 'linear-gradient(90deg,#10b981,#059669)' }}>
                    <div className="admin-stat-icon">📅</div>
                    <div className="admin-stat-value">{data.month || '—'}</div>
                    <div className="admin-stat-label">Aktuális hónap</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">🤖 Modellenkénti bontás</h3>
                    </div>
                    {modelChart.labels.length > 0 ? (
                        <div className="admin-chart-container">
                            <Bar data={modelChart} options={chartOptions} />
                        </div>
                    ) : (
                        <div className="admin-empty"><p className="admin-empty-text">Nincs adat</p></div>
                    )}
                </div>

                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3 className="admin-card-title">⚙️ Funkcióankénti bontás</h3>
                    </div>
                    {chainChart.labels.length > 0 ? (
                        <div className="admin-chart-container">
                            <Bar data={chainChart} options={chainOptions} />
                        </div>
                    ) : (
                        <div className="admin-empty"><p className="admin-empty-text">Nincs adat</p></div>
                    )}
                </div>
            </div>

            <div className="admin-card">
                <div className="admin-card-header">
                    <h3 className="admin-card-title">👤 Felhasználónkénti költség (Top {userEntries.length})</h3>
                </div>
                {userEntries.length > 0 ? (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Felhasználó</th>
                                    <th>Email</th>
                                    <th>Szerep</th>
                                    <th>Hívások</th>
                                    <th>Összeg (USD)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userEntries.map((u, i) => (
                                    <tr key={u.id}>
                                        <td style={{ color: '#64748b', fontSize: '13px' }}>{i + 1}</td>
                                        <td style={{ fontWeight: 500, color: '#e2e8f0' }}>{u.name || u.id}</td>
                                        <td style={{ color: '#64748b', fontSize: '12px' }}>{u.email || '—'}</td>
                                        <td>
                                            {u.role && (
                                                <span className={`admin-badge admin-badge-${u.role}`}>
                                                    {{ teacher: 'Tanár', student: 'Diák', parent: 'Szülő' }[u.role] || u.role}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>{u.callCount || 0}</td>
                                        <td style={{ fontWeight: 600, color: (u.totalCostUSD || 0) > 0.01 ? '#f87171' : '#4ade80' }}>
                                            ${(u.totalCostUSD || 0).toFixed(6)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="admin-empty"><p className="admin-empty-text">Nincs felhasználói cost adat</p></div>
                )}
            </div>
        </>
    );
};

const chainOptions = {
    ...chartOptions,
    plugins: {
        ...chartOptions.plugins,
    },
    scales: {
        ...chartOptions.scales,
        x: {
            ...chartOptions.scales.x,
            ticks: { ...chartOptions.scales.x.ticks, maxRotation: 45 },
        },
    },
};

export default AdminCosts;
