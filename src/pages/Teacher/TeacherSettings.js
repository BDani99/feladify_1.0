import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { updateProfile } from '../../api/Auth/UpdateProfile';
import { fetchAllClasses, createClass, updateTeacherClasses } from '../../api/Classes/ClassApi';
import { FaUser, FaPalette, FaLock, FaSave, FaCog, FaChalkboard, FaPlus, FaTrash, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { useUser } from '../../context/UserContext';
import '../../styles/Settings.css';

const CANONICAL_SUBJECTS = ['Nyelvtan', 'Irodalom', 'Angol', 'Matematika', 'Környezetismeret'];

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

    if (isLoading) {
        return (
            <div id="content">
                <LoadingSpinner />
            </div>
        );
    }

    const tabs = [
        { id: 'account', label: 'Fiók & Profil', icon: FaUser },
        { id: 'appearance', label: 'Megjelenés', icon: FaPalette },
        { id: 'organization', label: 'Osztályok & Tárgyak', icon: FaChalkboard },
        { id: 'privacy', label: 'Adatvédelem', icon: FaLock }
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
            </div>
        </div>
    );
};

export default TeacherSettings;
