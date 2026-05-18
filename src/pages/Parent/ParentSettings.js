import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { FaUserCog, FaBell, FaPalette, FaTrash, FaUserPlus, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Parent/ParentSettings.css';
import '../../styles/Student/StudentDashboard.css';

const ParentSettings = () => {
    const { theme, toggleTheme } = useUser() || {};
    const [activeTab, setActiveTab] = useState('children');
    const [children, setChildren] = useState([]);
    const [emailInput, setEmailInput] = useState('');

    const [notifyLowGrade, setNotifyLowGrade] = useState(true);
    const [lowGradeThreshold, setLowGradeThreshold] = useState(3);
    const [notifyUpcomingDeadline, setNotifyUpcomingDeadline] = useState(true);
    const [deadlineThresholdHours, setDeadlineThresholdHours] = useState(24);

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/parent/children', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setChildren(data.children || []);
                }

                const profileRes = await fetch('/api/auth/profile', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (profileRes.ok) {
                    const pData = await profileRes.json();
                    const settings = pData.user?.parentSettings || {};
                    setNotifyLowGrade(settings.notifyLowGrade !== false);
                    setLowGradeThreshold(settings.lowGradeThreshold || 3);
                    setNotifyUpcomingDeadline(settings.notifyUpcomingDeadline !== false);
                    setDeadlineThresholdHours(settings.deadlineThresholdHours || 24);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchSettings();
    }, []);

    const handleAddChild = async (e) => {
        e.preventDefault();
        if (!emailInput.trim()) return;
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await fetch('/api/parent/children/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({ email: emailInput.toLowerCase().trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setChildren(prev => [...prev, data.child]);
                setEmailInput('');
            } else {
                setError(data.message || 'Hiba történt a gyermek hozzáadásakor.');
            }
        } catch (err) {
            setError('Belső szerverhiba történt.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveChild = async (childId) => {
        if (!window.confirm('Biztosan szeretnéd lekapcsolni ezt a gyermeket?')) return;
        setError('');
        setMessage('');
        try {
            const res = await fetch('/api/parent/children/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({ childId })
            });
            if (res.ok) {
                setChildren(prev => prev.filter(c => c._id !== childId));
                setMessage('Gyermek sikeresen lekapcsolva.');
            } else {
                setError('Nem sikerült lekapcsolni a gyermeket.');
            }
        } catch (err) {
            setError('Hiba történt a kapcsolat bontása során.');
        }
    };

    const handleSaveNotifications = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await fetch('/api/parent/settings/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({
                    notifyLowGrade,
                    lowGradeThreshold: Number(lowGradeThreshold),
                    notifyUpcomingDeadline,
                    deadlineThresholdHours: Number(deadlineThresholdHours)
                })
            });
            if (res.ok) {
                setMessage('Értesítési beállítások sikeresen mentve.');
            } else {
                setError('Nem sikerült elmenteni a beállításokat.');
            }
        } catch (err) {
            setError('Hiba a beállítások mentésekor.');
        }
    };

    return (
        <div id="content">
          <div className="dashboard-container">
            <div className="page-header-banner">
                <div className="phb-icon"><FaUserCog /></div>
                <div className="phb-text">
                    <h1 className="phb-title">Beállítások</h1>
                    <p className="phb-subtitle">Fiókkezelés, gyermekkapcsolatok és értesítési szabályok.</p>
                </div>
            </div>

            <div className="glass-card parent-settings-card">
                {/* Tab panel */}
                <div className="parent-settings-tabs">
                    <button
                        className={`parent-settings-tab-btn${activeTab === 'children' ? ' active' : ''}`}
                        onClick={() => setActiveTab('children')}
                    >
                        <FaUserCog /> Gyermekek összekapcsolása
                    </button>
                    <button
                        className={`parent-settings-tab-btn${activeTab === 'notifications' ? ' active' : ''}`}
                        onClick={() => setActiveTab('notifications')}
                    >
                        <FaBell /> Értesítési beállítások
                    </button>
                    <button
                        className={`parent-settings-tab-btn${activeTab === 'appearance' ? ' active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                    >
                        <FaPalette /> Megjelenés
                    </button>
                </div>

                {/* Tartalom panel */}
                <div className="parent-settings-content">
                    {message && (
                        <div className="alert alert-success d-flex align-items-center gap-2 mb-4 py-2" role="alert">
                            <FaCheckCircle className="text-success" /> {message}
                        </div>
                    )}
                    {error && (
                        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 py-2" role="alert">
                            <FaExclamationCircle className="text-danger" /> {error}
                        </div>
                    )}

                    {/* Gyermekek */}
                    {activeTab === 'children' && (
                        <div>
                            <h4 className="parent-settings-section-title">Összekapcsolt Gyermekek</h4>

                            <form className="parent-add-child-form" onSubmit={handleAddChild}>
                                <input
                                    type="email"
                                    className="parent-add-child-input"
                                    placeholder="Gyermek regisztrált e-mail címe..."
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="main-button"
                                    style={{ width: 'auto', marginTop: 0, padding: '10px 20px', fontSize: '0.875rem' }}
                                    disabled={loading}
                                >
                                    <FaUserPlus /> {loading ? 'Hozzáadás...' : 'Gyermek hozzáadása'}
                                </button>
                            </form>

                            <div className="parent-children-list">
                                {children.length === 0 ? (
                                    <div className="parent-children-empty">
                                        Nincsenek kapcsolt gyermekek ehhez a fiókhoz. Adj meg egy e-mail címet a fenti mezőben!
                                    </div>
                                ) : (
                                    children.map(c => (
                                        <div key={c._id} className="parent-child-item">
                                            <div>
                                                <p className="parent-child-name">{c.name}</p>
                                                <p className="parent-child-detail">{c.email} • Osztály: {c.className}</p>
                                            </div>
                                            <button
                                                className="parent-child-remove-btn"
                                                onClick={() => handleRemoveChild(c._id)}
                                                title="Lekapcsolás"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Értesítések */}
                    {activeTab === 'notifications' && (
                        <form onSubmit={handleSaveNotifications}>
                            <h4 className="parent-settings-section-title">Szülői Értesítési Szabályok</h4>

                            <div className="parent-notif-block">
                                <div className="parent-notif-toggle-row">
                                    <span className="parent-notif-label">Értesítés gyenge osztályzat esetén</span>
                                    <div className="form-check form-switch m-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            role="switch"
                                            id="lowGradeSwitch"
                                            checked={notifyLowGrade}
                                            onChange={(e) => setNotifyLowGrade(e.target.checked)}
                                        />
                                    </div>
                                </div>
                                <p className="parent-notif-desc">Kapj azonnali e-mail és fali értesítést, ha a gyermeked dolgozata a megadott küszöb alatt teljesül.</p>
                                {notifyLowGrade && (
                                    <div className="parent-threshold-row">
                                        <span className="parent-threshold-label">Osztályzat küszöb (ennél rosszabbnál riaszt):</span>
                                        <select
                                            className="parent-threshold-select"
                                            value={lowGradeThreshold}
                                            onChange={(e) => setLowGradeThreshold(e.target.value)}
                                        >
                                            <option value="2">2 (Elégséges vagy rosszabb)</option>
                                            <option value="3">3 (Közepes vagy rosszabb)</option>
                                            <option value="4">4 (Jó vagy rosszabb)</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="parent-notif-block">
                                <div className="parent-notif-toggle-row">
                                    <span className="parent-notif-label">Értesítés közelgő határidőkről</span>
                                    <div className="form-check form-switch m-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            role="switch"
                                            id="deadlineSwitch"
                                            checked={notifyUpcomingDeadline}
                                            onChange={(e) => setNotifyUpcomingDeadline(e.target.checked)}
                                        />
                                    </div>
                                </div>
                                <p className="parent-notif-desc">Figyelmeztetést kapsz a még le nem adott házi dolgozatokról, mielőtt a határidő lejárna.</p>
                                {notifyUpcomingDeadline && (
                                    <div className="parent-threshold-row">
                                        <span className="parent-threshold-label">Időtartam lejárta előtt:</span>
                                        <select
                                            className="parent-threshold-select"
                                            value={deadlineThresholdHours}
                                            onChange={(e) => setDeadlineThresholdHours(e.target.value)}
                                        >
                                            <option value="12">12 órával előtte</option>
                                            <option value="24">24 órával előtte</option>
                                            <option value="48">48 órával előtte</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="main-button"
                                style={{ width: 'auto', marginTop: '8px', padding: '10px 24px' }}
                            >
                                Beállítások mentése
                            </button>
                        </form>
                    )}

                    {/* Megjelenés */}
                    {activeTab === 'appearance' && (
                        <div>
                            <h4 className="parent-settings-section-title">Rendszer Megjelenése</h4>
                            <p style={{ color: 'var(--color-text-dim)', fontSize: '0.875rem', marginBottom: '20px' }}>
                                Válassz a neked tetsző világos vagy sötét téma közül. A beállítás azonnal érvénybe lép minden képernyőn.
                            </p>
                            <div className="parent-appearance-row">
                                <span className="parent-appearance-label">Sötét téma aktiválása</span>
                                <div className="form-check form-switch m-0">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id="themeSwitch"
                                        checked={theme === 'dark'}
                                        onChange={toggleTheme}
                                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
    );
};

export default ParentSettings;
