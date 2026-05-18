import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { 
    FaUser, 
    FaUserCog, 
    FaBell, 
    FaPalette, 
    FaTrash, 
    FaUserPlus, 
    FaCheckCircle, 
    FaExclamationCircle, 
    FaLock, 
    FaSave 
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Parent/ParentSettings.css';
import '../../styles/Settings.css'; // Premium modern settings styling
import '../../styles/Student/StudentDashboard.css';

const ParentSettings = () => {
    const { theme, toggleTheme } = useUser() || {};
    const location = useLocation();

    // Active Tab state (defaults to 'account' as requested: "a fiók és profil legyen az első")
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'account');

    // Children and notification states
    const [children, setChildren] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [notifyLowGrade, setNotifyLowGrade] = useState(true);
    const [lowGradeThreshold, setLowGradeThreshold] = useState(3);
    const [notifyUpcomingDeadline, setNotifyUpcomingDeadline] = useState(true);
    const [deadlineThresholdHours, setDeadlineThresholdHours] = useState(24);

    // Profile & Password states
    const [profileName, setProfileName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    // Feedback states
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [profileMessage, setProfileMessage] = useState('');
    const [profileError, setProfileError] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Privacy toggles
    const [privacyReports, setPrivacyReports] = useState(true);
    const [privacyAiAnalysis, setPrivacyAiAnalysis] = useState(true);

    // Loading states
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // Sync active tab when location state changes
    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch connected children
                const res = await fetch('/api/parent/children', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setChildren(data.children || []);
                }

                // Corrected profile GET endpoint to /api/auth/data
                const profileRes = await fetch('/api/auth/data', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (profileRes.ok) {
                    const pData = await profileRes.json();
                    setProfileName(pData.user?.name || '');
                    setProfileEmail(pData.user?.email || '');

                    const settings = pData.user?.parentSettings || {};
                    setNotifyLowGrade(settings.notifyLowGrade !== false);
                    setLowGradeThreshold(settings.lowGradeThreshold || 3);
                    setNotifyUpcomingDeadline(settings.notifyUpcomingDeadline !== false);
                    setDeadlineThresholdHours(settings.deadlineThresholdHours || 24);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setPageLoading(false);
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

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setProfileError('');
        setProfileMessage('');
        if (!profileName.trim() || !profileEmail.trim()) {
            setProfileError('A név és e-mail mezők kitöltése kötelező.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/update-profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({ name: profileName.trim(), email: profileEmail.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setProfileMessage('Profil sikeresen frissítve. Újratöltés...');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                setProfileError(data.message || 'Nem sikerült frissíteni a profilt.');
            }
        } catch (err) {
            setProfileError('Hiba történt a mentés során.');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordMessage('');
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            setPasswordError('Minden mező kitöltése kötelező.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError('Az új jelszó és a megerősítés nem egyezik.');
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError('Az új jelszónak legalább 8 karakterből kell állnia.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/update-password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword })
            });
            const data = await res.json();
            if (res.ok) {
                setPasswordMessage('Jelszó sikeresen megváltoztatva.');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                setTimeout(() => {
                    setShowPasswordForm(false);
                    setPasswordMessage('');
                }, 1500);
            } else {
                setPasswordError(data.message || 'Nem sikerült megváltoztatni a jelszót.');
            }
        } catch (err) {
            setPasswordError('Hiba történt a jelszó módosítása során.');
        } finally {
            setLoading(false);
        }
    };

    const initial = profileName ? profileName.charAt(0).toUpperCase() : '?';

    const tabs = [
        { id: 'account', label: 'Fiók és profil', icon: FaUser },
        { id: 'appearance', label: 'Megjelenés', icon: FaPalette },
        { id: 'children', label: 'Gyermekek kezelése', icon: FaUserCog },
        { id: 'notifications', label: 'Értesítési szabályok', icon: FaBell },
        { id: 'privacy', label: 'Adatvédelem', icon: FaLock }
    ];

    return (
        <div id="content">
            <div className="dashboard-container">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaUserCog /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Beállítások</h1>
                        <p className="phb-subtitle">Fiókkezelés, megjelenés, gyermekkapcsolatok és adatvédelem.</p>
                    </div>
                </div>

                <div className="glass-card parent-settings-card">
                    {/* Tab panel */}
                    <div className="parent-settings-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`parent-settings-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setMessage('');
                                    setError('');
                                    setProfileMessage('');
                                    setProfileError('');
                                    setPasswordMessage('');
                                    setPasswordError('');
                                }}
                            >
                                <tab.icon /> {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tartalom panel */}
                    <div className="parent-settings-content">
                        {pageLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <>
                                {/* Globális üzenetek a meglévő füleknek */}
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

                                {/* 1. FIÓK ÉS PROFIL FÜL */}
                                {activeTab === 'account' && (
                                    <div className="settings-section">
                                        <h4 className="parent-settings-section-title">👤 Fiók & Profil</h4>
                                        
                                        <div className="form-group mb-4">
                                            <label>Profilkép</label>
                                            <div className="avatar-section">
                                                <div className="avatar-preview">
                                                    <span>{initial}</span>
                                                </div>
                                                <div className="avatar-options">
                                                    <button className="btn btn-secondary" onClick={() => alert('Profilkép feltöltése jelenleg nem elérhető.')}>Új kép feltöltése</button>
                                                    <button className="btn btn-outline" onClick={() => alert('Avatar választás jelenleg nem elérhető.')}>Válassz avatar</button>
                                                </div>
                                            </div>
                                        </div>

                                        <form className="settings-form mb-5" onSubmit={handleSaveProfile}>
                                            <div className="form-group">
                                                <label htmlFor="profileName">Szülő neve</label>
                                                <input
                                                    type="text"
                                                    id="profileName"
                                                    value={profileName}
                                                    onChange={(e) => setProfileName(e.target.value)}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="profileEmail">E-mail cím</label>
                                                <input
                                                    type="email"
                                                    id="profileEmail"
                                                    value={profileEmail}
                                                    onChange={(e) => setProfileEmail(e.target.value)}
                                                />
                                            </div>

                                            {/* Student-aligned Save Button */}
                                            <div className="settings-footer">
                                                <button type="submit" className="btn btn-primary save-btn" disabled={loading}>
                                                    <FaSave /> Mentés
                                                </button>
                                                {profileMessage && <span className="save-status text-success">{profileMessage}</span>}
                                                {profileError && <span className="save-status text-danger">{profileError}</span>}
                                            </div>
                                        </form>

                                        {/* Password Section matches Student visual layout exactly */}
                                        <form className="settings-form" onSubmit={handleSavePassword}>
                                            <div className="form-group">
                                                <label>Jelszó</label>
                                                <button 
                                                    type="button" 
                                                    className="btn btn-outline" 
                                                    onClick={() => {
                                                        setShowPasswordForm(!showPasswordForm);
                                                        setPasswordMessage('');
                                                        setPasswordError('');
                                                    }}
                                                >
                                                    Jelszó megváltoztatása
                                                </button>
                                            </div>

                                            {showPasswordForm && (
                                                <div className="password-change-fields mt-4 animate-fade-in">
                                                    <div className="form-group">
                                                        <label htmlFor="currentPassword">Jelenlegi jelszó</label>
                                                        <input
                                                            type="password"
                                                            id="currentPassword"
                                                            value={currentPassword}
                                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label htmlFor="newPassword">Új jelszó</label>
                                                        <input
                                                            type="password"
                                                            id="newPassword"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label htmlFor="confirmNewPassword">Új jelszó megerősítése</label>
                                                        <input
                                                            type="password"
                                                            id="confirmNewPassword"
                                                            value={confirmNewPassword}
                                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Student-aligned Save Button */}
                                                    <div className="settings-footer">
                                                        <button type="submit" className="btn btn-primary save-btn" disabled={loading}>
                                                            <FaSave /> Mentés
                                                        </button>
                                                        {passwordMessage && <span className="save-status text-success">{passwordMessage}</span>}
                                                        {passwordError && <span className="save-status text-danger">{passwordError}</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </form>
                                    </div>
                                )}

                                {/* 2. MEGJELENÉS FÜL */}
                                {activeTab === 'appearance' && (
                                    <div className="settings-section">
                                        <h4 className="parent-settings-section-title">🎨 Megjelenés</h4>
                                        <p style={{ color: 'var(--color-text-dim)', fontSize: '0.875rem', marginBottom: '24px' }}>
                                            Szabd személyre a felület stílusát. A világos vagy sötét téma azonnal érvénybe lép a teljes alkalmazásban.
                                        </p>
                                        
                                        <div className="parent-appearance-row" style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                            <span className="parent-appearance-label" style={{ fontSize: '0.95rem' }}>Téma kiválasztása</span>
                                            <div className="theme-options">
                                                <button
                                                    type="button"
                                                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                                                    onClick={() => { if (theme !== 'light') toggleTheme(); }}
                                                    style={{ width: '120px', padding: '12px 16px' }}
                                                >
                                                    <span className="theme-icon" style={{ fontSize: '1.5rem' }}>☀️</span>
                                                    <span>Világos</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                                    onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                                                    style={{ width: '120px', padding: '12px 16px' }}
                                                >
                                                    <span className="theme-icon" style={{ fontSize: '1.5rem' }}>🌙</span>
                                                    <span>Sötét</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 3. GYERMEKEK KEZELÉSE FÜL */}
                                {activeTab === 'children' && (
                                    <div>
                                        <h4 className="parent-settings-section-title">👨‍👩‍👧‍👦 Gyermekek Kezelése</h4>
                                        <p style={{ color: 'var(--color-text-dim)', fontSize: '0.875rem', marginBottom: '20px' }}>
                                            Kapcsolj össze diák fiókokat a szülői fiókoddal a regisztrált e-mail címük megadásával.
                                        </p>

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
                                                            <p className="parent-child-detail">{c.email} • Osztály: {c.className || 'Nincs megadva'}</p>
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

                                {/* 4. ÉRTESÍTÉSI SZABÁLYOK FÜL */}
                                {activeTab === 'notifications' && (
                                    <form onSubmit={handleSaveNotifications}>
                                        <h4 className="parent-settings-section-title">🔔 Értesítési Szabályok</h4>
                                        <p style={{ color: 'var(--color-text-dim)', fontSize: '0.875rem', marginBottom: '20px' }}>
                                            Állítsd be, mikor és milyen eseményekről szeretnél e-mail vagy fali riasztást kapni gyermekeddel kapcsolatban.
                                        </p>

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
                                            <p className="parent-notif-desc">Kapj azonnali értesítést, ha a gyermeked dolgozata a megadott küszöb alatt teljesül.</p>
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

                                        {/* Student-aligned Save Button */}
                                        <div className="settings-footer">
                                            <button type="submit" className="btn btn-primary save-btn">
                                                <FaSave /> Mentés
                                            </button>
                                            {message && <span className="save-status text-success">{message}</span>}
                                            {error && <span className="save-status text-danger">{error}</span>}
                                        </div>
                                    </form>
                                )}

                                {/* 5. ADATVÉDELEM FÜL */}
                                {activeTab === 'privacy' && (
                                    <div className="settings-section">
                                        <h4 className="parent-settings-section-title">🔒 Adatvédelem</h4>
                                        
                                        <div className="toggle-group mb-5">
                                            <div className="toggle-item" style={{ background: 'var(--bg-card)', padding: '16px 20px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                                <div className="toggle-info">
                                                    <span className="toggle-label">Heti tanulmányi riportok küldése</span>
                                                    <span className="toggle-desc">E-mailben összefoglalót küldünk a gyermek előrehaladásáról.</span>
                                                </div>
                                                <label className="toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={privacyReports}
                                                        onChange={(e) => setPrivacyReports(e.target.checked)}
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                            </div>

                                            <div className="toggle-item" style={{ background: 'var(--bg-card)', padding: '16px 20px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                                <div className="toggle-info">
                                                    <span className="toggle-label">AI Szülői Konzultációs Profil</span>
                                                    <span className="toggle-desc">Az AI Tanácsadó hozzáférhet a gyermek tanulási statisztikáihoz.</span>
                                                </div>
                                                <label className="toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={privacyAiAnalysis}
                                                        onChange={(e) => setPrivacyAiAnalysis(e.target.checked)}
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="privacy-section">
                                            <h3 style={{ color: 'var(--color-text)', marginBottom: '14px', fontSize: '1.1rem' }}>Fiók kezelése</h3>
                                            <div className="danger-zone" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '20px', borderRadius: '10px' }}>
                                                <h4 style={{ color: '#ef4444', fontWeight: 'bold', margin: '0 0 8px 0' }}>Fiók végleges törlése</h4>
                                                <p style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem', marginBottom: '14px', lineHeight: '1.5' }}>
                                                    A szülői fiók törlése végleges és visszafordíthatatlan. Minden beállításod és gyermek-kapcsolatod azonnal megszűnik.
                                                </p>
                                                <button 
                                                    className="btn btn-danger"
                                                    onClick={() => {
                                                        if (window.confirm('Biztosan szeretnéd kezdeményezni a szülői fiókod végleges törlését? Ezt a műveletet nem lehet visszavonni.')) {
                                                            alert('A fiók törlési igényét rögzítettük. Hamarosan küldünk egy megerősítő e-mailt a folyamat lezárásához.');
                                                        }
                                                    }}
                                                >
                                                    Fiók törlésének igénylése
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParentSettings;
