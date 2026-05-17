import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { FaUserCog, FaBell, FaPalette, FaTrash, FaUserPlus, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import '../../styles/Settings.css'; // Reuses dual-pane layout

const ParentSettings = () => {
    const { theme, toggleTheme } = useUser() || {};
    const [activeTab, setActiveTab] = useState('children'); // 'children', 'notifications', 'appearance'
    const [children, setChildren] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    
    // Notification preferences state
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
                // Fetch linked children
                const res = await fetch('/api/parent/children', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setChildren(data.children || []);
                }

                // Fetch parent account settings
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
        <div id="content" className="container py-4">
            <h1 className="main-title text-start mb-1">Beállítások</h1>
            <p className="text-muted mb-5">Fiókkezelés, gyermekkapcsolatok és értesítési szabályok.</p>

            <div className="glass-card d-flex flex-wrap p-0 text-start overflow-hidden mb-5" style={{ borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                {/* Left Pane Tabs */}
                <div className="col-12 col-md-3 border-end border-white border-opacity-10 py-4 px-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                    <div className="d-flex flex-column gap-2">
                        <button 
                            className={`btn w-100 text-start py-2.5 px-3 rounded-3 d-flex align-items-center gap-2 border-0 bg-transparent ${activeTab === 'children' ? 'text-primary bg-primary bg-opacity-10 font-weight-bold' : 'text-muted'}`}
                            onClick={() => setActiveTab('children')}
                        >
                            <FaUserCog /> Gyermekek összekapcsolása
                        </button>
                        <button 
                            className={`btn w-100 text-start py-2.5 px-3 rounded-3 d-flex align-items-center gap-2 border-0 bg-transparent ${activeTab === 'notifications' ? 'text-primary bg-primary bg-opacity-10 font-weight-bold' : 'text-muted'}`}
                            onClick={() => setActiveTab('notifications')}
                        >
                            <FaBell /> Értesítési beállítások
                        </button>
                        <button 
                            className={`btn w-100 text-start py-2.5 px-3 rounded-3 d-flex align-items-center gap-2 border-0 bg-transparent ${activeTab === 'appearance' ? 'text-primary bg-primary bg-opacity-10 font-weight-bold' : 'text-muted'}`}
                            onClick={() => setActiveTab('appearance')}
                        >
                            <FaPalette /> Megjelenés
                        </button>
                    </div>
                </div>

                {/* Right Pane Forms */}
                <div className="col-12 col-md-9 p-4 bg-transparent">
                    {message && (
                        <div className="alert alert-success glass-card d-flex align-items-center gap-2 mb-4 py-2" role="alert">
                            <FaCheckCircle className="text-success" /> {message}
                        </div>
                    )}
                    {error && (
                        <div className="alert alert-danger glass-card d-flex align-items-center gap-2 mb-4 py-2" role="alert">
                            <FaExclamationCircle className="text-danger" /> {error}
                        </div>
                    )}

                    {/* Tab: Children linkage */}
                    {activeTab === 'children' && (
                        <div>
                            <h4 className="mb-4" style={{ fontWeight: '700' }}>Összekapcsolt Gyermekek</h4>
                            
                            {/* Add Child Form */}
                            <form className="d-flex align-items-center gap-3 mb-5 flex-wrap" onSubmit={handleAddChild}>
                                <div className="flex-grow-1" style={{ minWidth: '240px' }}>
                                    <input 
                                        type="email"
                                        className="form-control rounded-pill bg-opacity-10 bg-secondary"
                                        placeholder="Gyermek regisztrált e-mail címe..."
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                        style={{ border: '1px solid rgba(255,255,255,0.1)', height: '44px', color: 'inherit' }}
                                    />
                                </div>
                                <button type="submit" className="main-button py-2.5 px-4 d-flex align-items-center gap-2" disabled={loading}>
                                    <FaUserPlus /> {loading ? 'Hozzáadás...' : 'Gyermek hozzáadása'}
                                </button>
                            </form>

                            {/* Linked Children List */}
                            <div className="d-flex flex-column gap-3">
                                {children.length === 0 ? (
                                    <div className="p-4 text-center text-muted border border-dashed rounded-4">
                                        Nincsenek kapcsolt gyermekek ehhez a fiókhoz. Adj meg egy e-mail címet a fenti mezőben!
                                    </div>
                                ) : (
                                    children.map(c => (
                                        <div 
                                            key={c._id} 
                                            className="p-3 d-flex align-items-center justify-content-between rounded-4"
                                            style={{ border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}
                                        >
                                            <div>
                                                <h6 className="mb-0" style={{ fontWeight: '700' }}>{c.name}</h6>
                                                <span className="text-muted small">{c.email} • Osztály: {c.className}</span>
                                            </div>
                                            <button className="btn btn-sm btn-outline-danger p-2 rounded-circle" onClick={() => handleRemoveChild(c._id)} title="Lekapcsolás">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab: Notification settings */}
                    {activeTab === 'notifications' && (
                        <form onSubmit={handleSaveNotifications}>
                            <h4 className="mb-4" style={{ fontWeight: '700' }}>Szülői Értesítési Szabályok</h4>

                            {/* Low grade alerts */}
                            <div className="mb-4 p-3 bg-secondary bg-opacity-5 rounded-4 text-start">
                                <div className="form-check form-switch mb-3">
                                    <input 
                                        className="form-check-input" 
                                        type="checkbox" 
                                        role="switch" 
                                        id="lowGradeSwitch"
                                        checked={notifyLowGrade}
                                        onChange={(e) => setNotifyLowGrade(e.target.checked)}
                                    />
                                    <label className="form-check-label font-weight-bold" htmlFor="lowGradeSwitch" style={{ fontWeight: '700' }}>Értesítés gyenge osztályzat esetén</label>
                                </div>
                                <p className="text-muted small mb-3">Kapj azonnali e-mail és fali értesítést, ha a gyermeked dolgozata a megadott küszöb alatt teljesül.</p>
                                
                                {notifyLowGrade && (
                                    <div className="d-flex align-items-center gap-3">
                                        <span className="text-muted small">Osztályzat küszöb (ennél rosszabb osztályzatoknál riaszt):</span>
                                        <select 
                                            className="form-select w-auto py-1 px-3 bg-dark text-white rounded-3 border-secondary"
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

                            {/* Upcoming deadlines alerts */}
                            <div className="mb-4 p-3 bg-secondary bg-opacity-5 rounded-4 text-start">
                                <div className="form-check form-switch mb-3">
                                    <input 
                                        className="form-check-input" 
                                        type="checkbox" 
                                        role="switch" 
                                        id="deadlineSwitch"
                                        checked={notifyUpcomingDeadline}
                                        onChange={(e) => setNotifyUpcomingDeadline(e.target.checked)}
                                    />
                                    <label className="form-check-label font-weight-bold" htmlFor="deadlineSwitch" style={{ fontWeight: '700' }}>Értesítés közelgő határidőkről</label>
                                </div>
                                <p className="text-muted small mb-3">Figyelmeztetést kapsz a még le nem adott házi dolgozatokról, mielőtt a határidő lejárna.</p>
                                
                                {notifyUpcomingDeadline && (
                                    <div className="d-flex align-items-center gap-3">
                                        <span className="text-muted small">Időtartam lejárta előtt:</span>
                                        <select 
                                            className="form-select w-auto py-1 px-3 bg-dark text-white rounded-3 border-secondary"
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

                            <button type="submit" className="main-button py-2.5 px-4 mt-2">
                                Beállítások mentése
                            </button>
                        </form>
                    )}

                    {/* Tab: Appearance */}
                    {activeTab === 'appearance' && (
                        <div>
                            <h4 className="mb-4" style={{ fontWeight: '700' }}>Rendszer Megjelenése</h4>
                            <p className="text-muted small mb-4">Válassz a neked tetsző világos vagy sötét téma közül. A beállítás azonnal érvénybe lép minden képernyőn.</p>
                            
                            <div className="p-3 bg-secondary bg-opacity-5 rounded-4 d-flex align-items-center justify-content-between">
                                <span className="font-weight-bold" style={{ fontWeight: '700' }}>Sötét téma aktiválása</span>
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
    );
};

export default ParentSettings;
