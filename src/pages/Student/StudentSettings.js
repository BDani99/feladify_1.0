import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { useLocation } from 'react-router-dom';
import { FaUser, FaPalette, FaBell, FaBullseye, FaLock, FaSave, FaBrain, FaCog } from 'react-icons/fa';
import { useUser } from '../../context/UserContext';
import '../../styles/Settings.css';

const StudentSettings = () => {
  const { toggleTheme, theme } = useUser() || {};
  const [userData, setUserData] = useState({
    email: '',
    name: '',
    className: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'account');
  const [settings, setSettings] = useState({
    theme: 'system',
    fontSize: 'normal',
    notifications: {
      newAssignment: true,
      upcomingDeadline: true,
      newEvaluation: true,
      streakReminder: true,
      emailNotifications: false,
      inAppNotifications: true
    },
    dailyGoal: 100,
    privacy: {
      showStats: false
    },
    aiTone: 'teacher',
    hintLevel: 'normal',
    ttsEnabled: false,
    dyslexicFont: false,
    roadmapTheme: 'default'
  });
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const userDataResponse = await fetchUserData();
        setUserData({
          email: userDataResponse.user.email,
          name: userDataResponse.user.name,
          className: userDataResponse.user.className || ''
        });
      } catch (error) {
        console.error('Error loading user data:', error);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: typeof prev[category] === 'object' 
        ? { ...prev[category], [key]: value }
        : value
    }));
  };

  const handleNotificationChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value }
    }));
  };

  const handlePrivacyChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      privacy: { ...prev.privacy, [key]: value }
    }));
  };

  const handleThemeChange = (newTheme) => {
    setSettings(prev => ({
      ...prev,
      theme: newTheme
    }));
    if (toggleTheme && (newTheme === 'dark' || newTheme === 'light')) {
      toggleTheme();
    }
  };

  const handleSave = async () => {
    setSaveStatus('Mentés folyamatban...');

    // Save to sessionStorage for immediate use (especially for AI Tutor settings)
    sessionStorage.setItem('studentSettings', JSON.stringify(settings));

    // Simulate backend save
    setTimeout(() => {
      setSaveStatus('Sikeresen mentve!');
      setTimeout(() => setSaveStatus(''), 3000);
    }, 800);
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
    { id: 'notifications', label: 'Értesítések', icon: FaBell },
    { id: 'goals', label: 'Tanulási Célok', icon: FaBullseye },
    { id: 'tutor', label: 'AI Asszisztens', icon: FaBrain },
    { id: 'privacy', label: 'Adatvédelem', icon: FaLock }
  ];

  return (
    <div id="content">
      <div className="settings-container modern-settings" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
        <div className="page-header-banner" style={{ marginBottom: '32px' }}>
            <div className="phb-icon"><FaCog /></div>
            <div className="phb-text">
                <h1 className="phb-title">Beállítások</h1>
                <p className="phb-subtitle">Szabd személyre a tanulási élményedet</p>
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
                  <label>Profilkép</label>
                  <div className="avatar-section">
                    <div className="avatar-preview">
                      <span>{userData.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="avatar-options">
                      <button className="btn btn-secondary">Új kép feltöltése</button>
                      <button className="btn btn-outline">Válassz avatar</button>
                    </div>
                  </div>
                </div>

                <form className="settings-form">
                  <div className="form-group">
                    <label htmlFor="name">Név</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={userData.name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={userData.email}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Osztály</label>
                    <div className="readonly-field">
                      {userData.className || 'Nincs megadva'}
                      <small className="field-hint">Az osztályt a tanár kezeli</small>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Jelszó</label>
                    <button type="button" className="btn btn-outline">Jelszó megváltoztatása</button>
                  </div>
                </form>
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
                    <button
                      className={`theme-btn ${settings.theme === 'system' ? 'active' : ''}`}
                      onClick={() => handleThemeChange('system')}
                    >
                      <span className="theme-icon">💻</span>
                      <span>Rendszer</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Betűméret</label>
                  <div className="font-size-options">
                    <button
                      className={`font-btn ${settings.fontSize === 'small' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('fontSize', null, 'small')}
                    >
                      Kis
                    </button>
                    <button
                      className={`font-btn ${settings.fontSize === 'normal' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('fontSize', null, 'normal')}
                    >
                      Normál
                    </button>
                    <button
                      className={`font-btn ${settings.fontSize === 'large' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('fontSize', null, 'large')}
                    >
                      Nagy
                    </button>
                  </div>
                </div>

                <h3>Kisegítő Lehetőségek</h3>
                <div className="toggle-group">
                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Felolvasás (Text-to-Speech)</span>
                      <span className="toggle-desc">AI válaszok felolvasása hangban</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.ttsEnabled}
                        onChange={(e) => handleSettingChange('ttsEnabled', null, e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Diszlexia-barát betűtípus</span>
                      <span className="toggle-desc">OpenDyslexic betűtípus bekapcsolása</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.dyslexicFont}
                        onChange={(e) => handleSettingChange('dyslexicFont', null, e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <h3>Tanulási Térkép Témája</h3>
                <div className="form-group">
                  <div className="theme-options roadmap-themes">
                    <button
                      className={`theme-btn ${settings.roadmapTheme === 'default' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('roadmapTheme', null, 'default')}
                    >
                      🗺️ Alap
                    </button>
                    <button
                      className={`theme-btn ${settings.roadmapTheme === 'space' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('roadmapTheme', null, 'space')}
                    >
                      🚀 Űrutazás
                    </button>
                    <button
                      className={`theme-btn ${settings.roadmapTheme === 'jungle' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('roadmapTheme', null, 'jungle')}
                    >
                      🌴 Dzsungel
                    </button>
                    <button
                      className={`theme-btn ${settings.roadmapTheme === 'wizard' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('roadmapTheme', null, 'wizard')}
                    >
                      🧙 Varázsló
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="settings-section">
                <h2>🔔 Értesítések</h2>

                <div className="toggle-group">
                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Új dolgozat kiírva</span>
                      <span className="toggle-desc">Értesítés, ha a tanár új dolgozatot ír ki</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.newAssignment}
                        onChange={(e) => handleNotificationChange('newAssignment', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Közelgő határidő (24 óra)</span>
                      <span className="toggle-desc">Emlékeztető a lejáró dolgozatokról</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.upcomingDeadline}
                        onChange={(e) => handleNotificationChange('upcomingDeadline', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Új tanári/AI értékelés</span>
                      <span className="toggle-desc">Értesítés, ha új értékelés érkezik</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.newEvaluation}
                        onChange={(e) => handleNotificationChange('newEvaluation', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Napi Streak emlékeztető</span>
                      <span className="toggle-desc">Ne szakadjon meg a napi láncolat</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.streakReminder}
                        onChange={(e) => handleNotificationChange('streakReminder', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <h3>Értesítési csatornák</h3>
                <div className="toggle-group">
                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Email értesítések</span>
                      <span className="toggle-desc">Fontos értesítések emailben</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.emailNotifications}
                        onChange={(e) => handleNotificationChange('emailNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Alkalmazáson belüli értesítések</span>
                      <span className="toggle-desc">Értesítések a felületen</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.notifications.inAppNotifications}
                        onChange={(e) => handleNotificationChange('inAppNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Goals Tab */}
            {activeTab === 'goals' && (
              <div className="settings-section">
                <h2>🎯 Tanulási Célok</h2>

                <div className="form-group">
                  <label>Napi XP cél</label>
                  <p className="setting-desc">Mennyi XP-t szeretnél naponta gyűjteni?</p>
                  
                  <div className="goal-options">
                    <button
                      className={`goal-btn ${settings.dailyGoal === 50 ? 'active' : ''}`}
                      onClick={() => handleSettingChange('dailyGoal', null, 50)}
                    >
                      <span className="goal-value">50 XP</span>
                      <span className="goal-label">Laza</span>
                    </button>
                    <button
                      className={`goal-btn ${settings.dailyGoal === 100 ? 'active' : ''}`}
                      onClick={() => handleSettingChange('dailyGoal', null, 100)}
                    >
                      <span className="goal-value">100 XP</span>
                      <span className="goal-label">Normál</span>
                    </button>
                    <button
                      className={`goal-btn ${settings.dailyGoal === 200 ? 'active' : ''}`}
                      onClick={() => handleSettingChange('dailyGoal', null, 200)}
                    >
                      <span className="goal-value">200 XP</span>
                      <span className="goal-label">Intenzív</span>
                    </button>
                  </div>
                </div>

                <div className="goal-preview">
                  <h4>Heti cél: {settings.dailyGoal * 7} XP</h4>
                  <div className="goal-progress-bar">
                    <div className="goal-progress" style={{ width: '35%' }}></div>
                  </div>
                  <p className="goal-progress-text">35% teljesítve ezen a héten</p>
                </div>
              </div>
            )}

            {/* AI Asszisztens Tab */}
            {activeTab === 'tutor' && (
              <div className="settings-section">
                <h2>🧠 AI Tanár Beállítások</h2>

                <div className="form-group">
                  <h3>AI Személyiség és Hangvétel</h3>
                  <p className="setting-desc">Válaszd ki, hogyan tanítson az AI asszisztensd!</p>
                  <div className="tone-options">
                    <button
                      className={`tone-btn ${settings.aiTone === 'adventurous' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('aiTone', null, 'adventurous')}
                    >
                      <strong>🎭 Kalandor</strong>
                      <span>Játékos, sztorizós stílus</span>
                    </button>
                    <button
                      className={`tone-btn ${settings.aiTone === 'scholar' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('aiTone', null, 'scholar')}
                    >
                      <strong>📚 Tudós</strong>
                      <span>Komoly, tényalapú magyarázatok</span>
                    </button>
                    <button
                      className={`tone-btn ${settings.aiTone === 'teacher' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('aiTone', null, 'teacher')}
                    >
                      <strong>👨‍🏫 Klasszikus Tanár</strong>
                      <span>Támogató, formálisabb stílus</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <h3>Rávezetési Segítség Szintje</h3>
                  <p className="setting-desc">Mennyire részletesek legyenek az AI tippek?</p>
                  <div className="hint-options">
                    <button
                      className={`hint-btn ${settings.hintLevel === 'strict' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('hintLevel', null, 'strict')}
                    >
                      <strong>🎯 Szigorú</strong>
                      <span>Csak apró utalások, kihívó mód</span>
                    </button>
                    <button
                      className={`hint-btn ${settings.hintLevel === 'normal' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('hintLevel', null, 'normal')}
                    >
                      <strong>⚖️ Normal</strong>
                      <span>3 próbálkozás után a megoldás</span>
                    </button>
                    <button
                      className={`hint-btn ${settings.hintLevel === 'lenient' ? 'active' : ''}`}
                      onClick={() => handleSettingChange('hintLevel', null, 'lenient')}
                    >
                      <strong>🤝 Könnyített</strong>
                      <span>2 próbálkozás után a megoldás</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="settings-section">
                <h2>🔒 Adatvédelem</h2>

                <div className="toggle-group">
                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Statisztikák láthatósága</span>
                      <span className="toggle-desc">Más diákok láthatják a statisztikáidat (ranglista)</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.privacy.showStats}
                        onChange={(e) => handlePrivacyChange('showStats', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="privacy-section">
                  <h3>Fiók kezelése</h3>
                  <div className="danger-zone">
                    <h4>Fiók törlése</h4>
                    <p>
                      A fiók törlése végleges. Minden adatod (dolgozatok, statisztikák, előrehaladás) 
                      törlődik. Ez a művelet nem vonható vissza.
                    </p>
                    <button className="btn btn-danger">Fiók törlésének igénylése</button>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="settings-footer">
              <button className="btn btn-primary save-btn" onClick={handleSave}>
                <FaSave /> Mentés
              </button>
              {saveStatus && <span className="save-status">{saveStatus}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSettings;