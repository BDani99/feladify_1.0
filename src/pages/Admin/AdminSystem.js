import React, { useEffect, useState } from 'react';
import { getSystemInfo, updateUser } from '../../api/Admin/AdminApi';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { toast } from 'react-toastify';

const InfoCard = ({ title, children }) => (
    <div className="admin-card">
        <div className="admin-card-header">
            <h3 className="admin-card-title">{title}</h3>
        </div>
        {children}
    </div>
);

const AdminSystem = () => {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPassForm, setShowPassForm] = useState(false);
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [savingPass, setSavingPass] = useState(false);
    const { adminUser } = useAdminAuth();

    useEffect(() => {
        getSystemInfo()
            .then(setInfo)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handlePassChange = async (e) => {
        e.preventDefault();
        if (newPass.length < 8) { toast.error('A jelszó legalább 8 karakter legyen!'); return; }
        if (newPass !== confirmPass) { toast.error('A két jelszó nem egyezik!'); return; }
        setSavingPass(true);
        try {
            await updateUser(adminUser?.id, { password: newPass });
            toast.success('Jelszó sikeresen megváltoztatva!');
            setNewPass(''); setConfirmPass(''); setShowPassForm(false);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSavingPass(false);
        }
    };

    if (loading) return <div className="admin-loading"><div className="admin-spinner" /><span>Rendszerinfó betöltése...</span></div>;
    if (error) return <div className="admin-card"><p style={{ color: '#f87171', textAlign: 'center' }}>⚠️ {error}</p></div>;

    const dbStateColor = info?.db?.state === 'connected' ? 'green' : info?.db?.state === 'connecting' ? 'yellow' : 'red';
    const dbStateLabel = { connected: 'Csatlakozva', disconnected: 'Nincs kapcsolat', connecting: 'Csatlakozás...', disconnecting: 'Lecsatlakozás...' }[info?.db?.state] || info?.db?.state;

    const apiKeys = info?.apiKeys || {};

    return (
        <>
            <div className="admin-page-header">
                <h2 className="admin-page-title">Rendszer</h2>
                <p className="admin-page-subtitle">Szerver állapot, API kulcsok és adminisztratív beállítások</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <InfoCard title="🗄️ Adatbázis állapot">
                    <div className="admin-info-row">
                        <span className="admin-info-key">Kapcsolat</span>
                        <span className="admin-info-value">
                            <span className={`admin-status-dot ${dbStateColor}`} />
                            {dbStateLabel}
                        </span>
                    </div>
                    <div className="admin-info-row">
                        <span className="admin-info-key">Ready state</span>
                        <span className="admin-info-value">{info?.db?.readyState}</span>
                    </div>
                </InfoCard>

                <InfoCard title="🔑 API kulcsok állapota">
                    {Object.entries(apiKeys).map(([name, value]) => (
                        <div key={name} className="admin-info-row">
                            <span className="admin-info-key">{name}</span>
                            {value ? (
                                <span className="admin-info-value" style={{ color: '#4ade80' }}>
                                    <span className="admin-status-dot green" />
                                    {value}
                                </span>
                            ) : (
                                <span style={{ fontSize: '13px', color: '#f87171' }}>
                                    <span className="admin-status-dot red" />
                                    Hiányzik
                                </span>
                            )}
                        </div>
                    ))}
                </InfoCard>

                <InfoCard title="⚙️ Szerver infó">
                    <div className="admin-info-row">
                        <span className="admin-info-key">Node.js verzió</span>
                        <span className="admin-info-value">{info?.node}</span>
                    </div>
                    <div className="admin-info-row">
                        <span className="admin-info-key">Platform</span>
                        <span className="admin-info-value">{info?.platform}</span>
                    </div>
                    <div className="admin-info-row">
                        <span className="admin-info-key">Uptime</span>
                        <span className="admin-info-value">
                            {info?.uptime ? `${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m` : '—'}
                        </span>
                    </div>
                    <div className="admin-info-row">
                        <span className="admin-info-key">Szerver idő</span>
                        <span className="admin-info-value" style={{ fontSize: '11px' }}>
                            {info?.serverTime ? new Date(info.serverTime).toLocaleString('hu-HU') : '—'}
                        </span>
                    </div>
                    <div className="admin-info-row">
                        <span className="admin-info-key">Cost tracking hónap</span>
                        <span className="admin-info-value">{info?.costMonth || '—'}</span>
                    </div>
                </InfoCard>

                <InfoCard title="🔐 Admin fiók kezelése">
                    <div className="admin-info-row">
                        <span className="admin-info-key">Felhasználónév</span>
                        <span className="admin-info-value">{adminUser?.name}</span>
                    </div>
                    <div className="admin-info-row">
                        <span className="admin-info-key">Szerepkör</span>
                        <span className="admin-info-value">
                            <span className="admin-badge admin-badge-admin">Admin</span>
                        </span>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                        {!showPassForm ? (
                            <button
                                className="admin-btn admin-btn-ghost"
                                onClick={() => setShowPassForm(true)}
                            >
                                🔑 Jelszó megváltoztatása
                            </button>
                        ) : (
                            <form onSubmit={handlePassChange}>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Új jelszó</label>
                                    <input
                                        className="admin-form-input"
                                        type="password"
                                        placeholder="Min. 8 karakter"
                                        value={newPass}
                                        onChange={e => setNewPass(e.target.value)}
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Jelszó megerősítése</label>
                                    <input
                                        className="admin-form-input"
                                        type="password"
                                        placeholder="Jelszó újra"
                                        value={confirmPass}
                                        onChange={e => setConfirmPass(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button type="submit" className="admin-btn admin-btn-primary" disabled={savingPass}>
                                        {savingPass ? 'Mentés...' : 'Mentés'}
                                    </button>
                                    <button type="button" className="admin-btn admin-btn-ghost" onClick={() => { setShowPassForm(false); setNewPass(''); setConfirmPass(''); }}>
                                        Mégse
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </InfoCard>
            </div>
        </>
    );
};

export default AdminSystem;
