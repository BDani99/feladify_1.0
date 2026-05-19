import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { updateProfile } from '../../api/Auth/UpdateProfile';
import { fetchAllClasses, createClass, updateTeacherClasses } from '../../api/Classes/ClassApi';
import { FaUser, FaPalette, FaLock, FaSave, FaCog, FaChalkboard, FaPlus, FaTrash, FaCheckCircle, FaExclamationCircle, FaFlask, FaSyncAlt } from 'react-icons/fa';
import { useUser } from '../../context/UserContext';
import { API_BASE_URL } from '../../api/config';
import '../../styles/Settings.css';

const CANONICAL_SUBJECTS = ['Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Matematika', 'Környezetismeret', 'Történelem', 'Fizika', 'Biológia', 'Földrajz'];

const TeacherSettings = () => {
    const { toggleTheme } = useUser() || {};
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [myClassIds, setMyClassIds] = useState([]);
    const [newClassName, setNewClassName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCreatingClass, setIsCreatingClass] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [saveError, setSaveError] = useState('');
    const [classError, setClassError] = useState('');
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'account');
    const [settings, setSettings] = useState({
        theme: 'dark',
        fontSize: 'normal',
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                const [userResp, allCls, myCls] = await Promise.all([
                    fetchUserData(),
                    fetchAllClasses(),
                    fetchTeacherClasses(),
                ]);
                setName(userResp.user.name || '');
                setEmail(userResp.user.email || '');
                setSelectedSubjects(userResp.user.subjects || []);
                setAllClasses(allCls || []);
                setMyClassIds((myCls || []).map(c => c._id));
            } catch (error) {
                console.error('Hiba az adatok betöltése során:', error);
                setSaveError('Nem sikerült betölteni az adatokat. Kérjük, próbáld újra.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);

    const toggleSubject = (subject) => {
        setSelectedSubjects(prev =>
            prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
        );
    };

    const toggleClass = (classId) => {
        setMyClassIds(prev =>
            prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
        );
    };

    const handleCreateClass = async () => {
        if (!newClassName.trim()) return;
        setIsCreatingClass(true);
        setClassError('');
        try {
            const result = await createClass(newClassName.trim());
            setAllClasses(prev => [...prev, result.class]);
            setMyClassIds(prev => [...prev, result.class._id]);
            setNewClassName('');
        } catch (err) {
            setClassError(err.message);
        } finally {
            setIsCreatingClass(false);
        }
    };

    const handleThemeChange = (newTheme) => {
        setSettings(prev => ({ ...prev, theme: newTheme }));
        if (toggleTheme && (newTheme === 'dark' || newTheme === 'light')) {
            toggleTheme();
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveMessage('');
        setSaveError('');
        try {
            await Promise.all([
                updateProfile({ name, email, subjects: selectedSubjects }),
                updateTeacherClasses(myClassIds),
            ]);
            setSaveMessage('Beállítások sikeresen mentve.');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
            setSaveError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const [costData, setCostData] = useState(null);
    const [costLoading, setCostLoading] = useState(false);

    const loadCostData = async () => {
        setCostLoading(true);
        try {
            const token = localStorage.getItem('AccessToken');
            const res = await fetch(`${API_BASE_URL}/admin/cost-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setCostData(await res.json());
        } catch {}
        finally { setCostLoading(false); }
    };

    useEffect(() => {
        if (activeTab === 'ai-costs') loadCostData();
    }, [activeTab]);

    const tabs = [
        { id: 'account', label: 'Fiók & Profil', icon: FaUser },
        { id: 'appearance', label: 'Megjelenés', icon: FaPalette },
        { id: 'organization', label: 'Osztályok & Tárgyak', icon: FaChalkboard },
        { id: 'privacy', label: 'Adatvédelem', icon: FaLock },
        { id: 'ai-costs', label: 'AI Költségek', icon: FaFlask }
    ];

    return (
        <div id="content">
            <div className="settings-container modern-settings" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
                <div className="page-header-banner" style={{ marginBottom: '32px' }}>
                    <div className="phb-icon"><FaCog /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Beállítások</h1>
                        <p className="phb-subtitle">Kezeld a profilodat és az osztályaidat</p>
                    </div>
                </div>

                {isLoading ? (
                    <LoadingSpinner />
                ) : (
                <div className="settings-layout">
                    {/* Sidebar Tabs */}
                    <div className="settings-sidebar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <tab.icon className="tab-icon" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="settings-content">
                        {/* Account Tab */}
                        {activeTab === 'account' && (
                            <div className="settings-section">
                                <h2>👤 Fiók & Profil</h2>
                                <div className="form-group">
                                    <label>Név</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Add meg a neved..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Add meg az email címed..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Jelszó</label>
                                    <button type="button" className="btn btn-outline">Jelszó megváltoztatása</button>
                                </div>
                            </div>
                        )}

                        {/* Organization Tab */}
                        {activeTab === 'organization' && (
                            <div className="settings-section">
                                <h2>🏫 Osztályok & Tantárgyak</h2>
                                
                                <h3>Választott tantárgyak</h3>
                                <div className="toggle-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                                    {CANONICAL_SUBJECTS.map(subject => (
                                        <button
                                            key={subject}
                                            type="button"
                                            className={`font-btn ${selectedSubjects.includes(subject) ? 'active' : ''}`}
                                            onClick={() => toggleSubject(subject)}
                                            style={{ padding: '10px', fontSize: '0.9rem' }}
                                        >
                                            {subject}
                                        </button>
                                    ))}
                                </div>

                                <h3 style={{ marginTop: '30px' }}>Kezelt osztályok</h3>
                                <div className="toggle-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                                    {allClasses.map(cls => (
                                        <button
                                            key={cls._id}
                                            type="button"
                                            className={`font-btn ${myClassIds.includes(cls._id) ? 'active' : ''}`}
                                            onClick={() => toggleClass(cls._id)}
                                            style={{ padding: '10px', fontSize: '0.9rem' }}
                                        >
                                            {cls.name}
                                        </button>
                                    ))}
                                </div>

                                <div className="class-create-row" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                    <input
                                        type="text"
                                        placeholder="Új osztály neve..."
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--color-text)' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleCreateClass}
                                        disabled={isCreatingClass || !newClassName.trim()}
                                    >
                                        <FaPlus /> {isCreatingClass ? '...' : 'Létrehozás'}
                                    </button>
                                </div>
                                {classError && <p className="error-message" style={{ marginTop: '10px' }}><FaExclamationCircle /> {classError}</p>}
                            </div>
                        )}

                        {/* Appearance Tab */}
                        {activeTab === 'appearance' && (
                            <div className="settings-section">
                                <h2>🎨 Megjelenés</h2>
                                <div className="form-group">
                                    <label>Téma</label>
                                    <div className="theme-options">
                                        <button
                                            className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                                            onClick={() => handleThemeChange('light')}
                                        >
                                            <span className="theme-icon">☀️</span>
                                            <span>Világos</span>
                                        </button>
                                        <button
                                            className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                                            onClick={() => handleThemeChange('dark')}
                                        >
                                            <span className="theme-icon">🌙</span>
                                            <span>Sötét</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Betűméret</label>
                                    <div className="font-size-options">
                                        {['small', 'normal', 'large'].map(size => (
                                            <button
                                                key={size}
                                                className={`font-btn ${settings.fontSize === size ? 'active' : ''}`}
                                                onClick={() => handleSettingChange('fontSize', size)}
                                            >
                                                {size === 'small' ? 'Kicsi' : size === 'normal' ? 'Normál' : 'Nagy'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Privacy Tab */}
                        {activeTab === 'privacy' && (
                            <div className="settings-section">
                                <h2>🔒 Adatvédelem</h2>
                                <div className="danger-zone" style={{ marginTop: '0' }}>
                                    <h4>Fiók törlése</h4>
                                    <p>A fiók törlése végleges és minden adatot (osztályok, dolgozatok) töröl.</p>
                                    <button className="btn btn-danger">Fiók törlésének igénylése</button>
                                </div>
                            </div>
                        )}

                        {/* AI Costs Tab */}
                        {activeTab === 'ai-costs' && (
                            <div className="settings-section">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                    <h2 style={{ margin: 0 }}>🧪 AI Költség Szimulátor</h2>
                                    <button
                                        onClick={loadCostData}
                                        disabled={costLoading}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
                                    >
                                        <FaSyncAlt style={{ animation: costLoading ? 'spin 0.8s linear infinite' : 'none' }} />
                                        Frissítés
                                    </button>
                                </div>
                                <p style={{ color: 'var(--color-text-dim)', fontSize: '0.82rem', marginBottom: 24, marginTop: -10 }}>
                                    Valós token számlálás az API response usage mezőből. Árak: 2026-05, DeepSeek + DashScope.
                                </p>

                                {costLoading ? (
                                    <LoadingSpinner />
                                ) : !costData || !costData.month ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-dim)' }}>
                                        Még nincs adat – generálj dolgozatot vagy indíts diagnosztikát.
                                    </div>
                                ) : (() => {
                                    const bm = costData.byModel || {};
                                    const bc = costData.byChain || {};
                                    const callers = costData.byCaller || {};
                                    const total = costData.totalCostUSD || 0;
                                    const totalIn = costData.totalInputTokens || 0;
                                    const totalOut = costData.totalOutputTokens || 0;

                                    const modelRows = [
                                        { key: 'deepseek-reasoner', label: 'deepseek-reasoner', chain: 'reasoning', color: '#6366f1' },
                                        { key: 'qwen-plus',         label: 'qwen-plus',         chain: 'reasoning', color: '#8b5cf6' },
                                        { key: 'deepseek-chat',     label: 'deepseek-chat',     chain: 'fast',      color: '#0ea5e9' },
                                        { key: 'qwen-turbo',        label: 'qwen-turbo',        chain: 'fast',      color: '#38bdf8' },
                                    ];

                                    const fmt = (v) => v == null ? '$0.0000' : `$${Number(v).toFixed(4)}`;
                                    const fmtTok = (v) => v == null ? '0' : Number(v).toLocaleString('hu-HU');
                                    const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;
                                    const avgTok = (d) => d.calls > 0 ? Math.round((d.inputTokens + d.outputTokens) / d.calls) : 0;

                                    const callerEntries = Object.entries(callers)
                                        .sort((a, b) => b[1].costUSD - a[1].costUSD);

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                                            {/* Összesítő hero */}
                                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '24px 28px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Havi összesítő</div>
                                                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', letterSpacing: '-1px' }}>{fmt(total)}</div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: 2 }}>{costData.month} · {costData.callCount} AI hívás</div>
                                                    <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                                                        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>
                                                            Input: <strong style={{ color: 'var(--color-text)' }}>{fmtTok(totalIn)} tok</strong>
                                                        </div>
                                                        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>
                                                            Output: <strong style={{ color: 'var(--color-text)' }}>{fmtTok(totalOut)} tok</strong>
                                                        </div>
                                                        <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>
                                                            Össz: <strong style={{ color: 'var(--color-text)' }}>{fmtTok(totalIn + totalOut)} tok</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {['reasoning', 'fast'].map(ct => (
                                                        <div key={ct} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: ct === 'reasoning' ? '#6366f1' : '#0ea5e9', textTransform: 'uppercase', letterSpacing: 0.8 }}>{ct === 'reasoning' ? '🧠 Reasoning' : '⚡ Fast'}</div>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{fmt(bc[ct]?.costUSD)}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>{bc[ct]?.calls ?? 0} hívás · {pct(bc[ct]?.costUSD ?? 0)}%</div>
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 3 }}>
                                                                in: {fmtTok(bc[ct]?.inputTokens)} · out: {fmtTok(bc[ct]?.outputTokens)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Modellenként */}
                                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '20px 24px' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Modellenként</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                                    {modelRows.map(({ key, label, chain, color }) => {
                                                        const d = bm[key] || { calls: 0, costUSD: 0, inputTokens: 0, outputTokens: 0 };
                                                        const barW = pct(d.costUSD);
                                                        return (
                                                            <div key={key}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)' }}>{label}</span>
                                                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: chain === 'reasoning' ? 'rgba(99,102,241,0.12)' : 'rgba(14,165,233,0.12)', color: chain === 'reasoning' ? '#6366f1' : '#0ea5e9' }}>
                                                                            {chain === 'reasoning' ? 'reasoning' : 'fast'}
                                                                        </span>
                                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                                                                            in {fmtTok(d.inputTokens)} · out {fmtTok(d.outputTokens)}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>{d.calls} hívás</span>
                                                                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)', minWidth: 80, textAlign: 'right' }}>{fmt(d.costUSD)}</span>
                                                                        <span style={{ fontSize: '0.72rem', color, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{barW}%</span>
                                                                    </div>
                                                                </div>
                                                                <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 6, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${barW}%`, background: color, borderRadius: 6, transition: 'width 0.5s' }} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Hívások forrása */}
                                            {callerEntries.length > 0 && (
                                                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '20px 24px' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Hívások forrása</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '6px 16px', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Függvény</div>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Hívás</div>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Input tok</div>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Output tok</div>
                                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Költség</div>
                                                        {callerEntries.map(([name, d]) => (
                                                            <React.Fragment key={name}>
                                                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'right' }}>{d.calls}×</div>
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'right' }}>{fmtTok(d.inputTokens)}</div>
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'right' }}>{fmtTok(d.outputTokens)}</div>
                                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right' }}>{fmt(d.costUSD)}</div>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Felhasználónkénti bontás */}
                                            {(() => {
                                                const userEntries = Object.entries(costData.byUser || {})
                                                    .sort((a, b) => (b[1].costUSD || 0) - (a[1].costUSD || 0));
                                                if (userEntries.length === 0) return null;
                                                return (
                                                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '20px 24px' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Felhasználónkénti fogyasztás</div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '6px 16px', alignItems: 'center' }}>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>Felhasználó</div>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Hívás</div>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Input tok</div>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Output tok</div>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Költség</div>
                                                            {userEntries.map(([uid, d]) => (
                                                                <React.Fragment key={uid}>
                                                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        <span>{d.name || uid}</span>
                                                                        {d.role && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--color-text-dim)', fontWeight: 500 }}>[{d.role}]</span>}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'right' }}>{d.calls}×</div>
                                                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'right' }}>{fmtTok(d.inputTokens)}</div>
                                                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textAlign: 'right' }}>{fmtTok(d.outputTokens)}</div>
                                                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right' }}>{fmt(d.costUSD)}</div>
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Árak referencia */}
                                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '16px 24px' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Ártáblázat ($ / 1M token)</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                                                    {[
                                                        { label: 'deepseek-reasoner', inp: '$0.55',  out: '$2.19', color: '#6366f1' },
                                                        { label: 'qwen-plus',         inp: '$0.40',  out: '$1.20', color: '#8b5cf6' },
                                                        { label: 'deepseek-chat',     inp: '$0.14',  out: '$0.28', color: '#0ea5e9' },
                                                        { label: 'qwen-turbo',        inp: '$0.05',  out: '$0.20', color: '#38bdf8' },
                                                    ].map(m => (
                                                        <div key={m.label} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${m.color}30`, background: `${m.color}08` }}>
                                                            <div style={{ fontWeight: 800, fontSize: '0.78rem', color: m.color, marginBottom: 4 }}>{m.label}</div>
                                                            <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>Input: <strong style={{ color: 'var(--color-text)' }}>{m.inp}</strong></div>
                                                            <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)' }}>Output: <strong style={{ color: 'var(--color-text)' }}>{m.out}</strong></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Save Footer */}
                        <div className="settings-footer">
                            <button className="btn btn-primary save-btn" onClick={handleSave} disabled={isSaving}>
                                <FaSave /> {isSaving ? 'Mentés...' : 'Mentés'}
                            </button>
                            {saveMessage && <span className="save-status"><FaCheckCircle /> {saveMessage}</span>}
                            {saveError && <span className="error-message"><FaExclamationCircle /> {saveError}</span>}
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};

export default TeacherSettings;
