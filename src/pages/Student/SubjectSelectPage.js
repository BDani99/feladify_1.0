import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../api/config';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaStar, FaFire, FaBolt, FaCalculator, FaBookOpen, FaGlobeAmericas, FaLeaf, FaChevronDown, FaChevronUp, FaTrash, FaCompass, FaHistory, FaAtom, FaDna, FaMapMarkedAlt } from 'react-icons/fa';
import '../../styles/Student/SubjectSelectPage.css';
import ConfirmModal from '../../components/ConfirmModal';
import { toast } from 'react-toastify';
import { XP_PER_LEVEL } from '../../utils/xpConstants';

const SubjectSelectPage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalXP: 0, streak: 0 });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState({});
  const [confirmResetModal, setConfirmResetModal] = useState({ isOpen: false, type: 'all', subjectName: null, message: '' });

  const subjectList = [
    { name: 'Matematika', icon: <FaCalculator />, subject: 'Matematika', color: '#a5b4fc' },
    { name: 'Nyelvtan', icon: <FaBookOpen />, subject: 'Nyelvtan', color: '#22d3ee' },
    { name: 'Irodalom', icon: <FaBookOpen />, subject: 'Irodalom', color: '#34d399' },
    { name: 'Angol', icon: <FaGlobeAmericas />, subject: 'Angol', color: '#c084fc' },
    { name: 'Környezetismeret', icon: <FaLeaf />, subject: 'Környezetismeret', color: '#fb923c' },
    { name: 'Történelem', icon: <FaHistory />, subject: 'Történelem', color: '#f43f5e' },
    { name: 'Fizika', icon: <FaAtom />, subject: 'Fizika', color: '#60a5fa' },
    { name: 'Biológia', icon: <FaDna />, subject: 'Biológia', color: '#4ade80' },
    { name: 'Földrajz', icon: <FaMapMarkedAlt />, subject: 'Földrajz', color: '#fbbf24' }
  ];

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      const token = localStorage.getItem('AccessToken');
      // Fetch student progress for all subjects
      const response = await fetch(`${API_BASE_URL}/student/progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.progress) {
          setSubjects(data.progress);
          setStats({ totalXP: data.totalXP || 0, streak: data.streak || 0 });
        }
      } else {
        console.error('Nem sikerült a progress adatok lekérése');
      }
    } catch (err) {
      console.error('Hiba a progress adatok betöltésekor:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSubjectStatus = (subjectName) => {
    const found = subjects.find(s => s.subject === subjectName);
    if (!found) return { status: 'not_started', percentage: 0, level: 1 };
    const cps = found.checkpoints || [];
    const completed = cps.filter(c => c.status === 'completed').length;
    const percentage = cps.length > 0 ? Math.round((completed / cps.length) * 100) : 0;
    return {
      status: found.status || 'not_started',
      percentage,
      level: found.currentLevel || 1
    };
  };

  const handleSubjectClick = (subject) => {
    navigate(`/egyeni-gyakorlas/${subject}`);
  };

  const handleResetAll = () => {
    setConfirmResetModal({
      isOpen: true,
      type: 'all',
      subjectName: null,
      message: 'Biztosan törlöd AZ ÖSSZES tantárgy egyéni gyakorlás adatát? Ez visszafordíthatatlan!'
    });
  };

  const handleResetSubject = (subject) => {
    setConfirmResetModal({
      isOpen: true,
      type: 'subject',
      subjectName: subject,
      message: `Biztosan törlöd a(z) "${subject}" tantárgy összes adatát?`
    });
  };

  const executeReset = async () => {
    const { type, subjectName } = confirmResetModal;
    setConfirmResetModal({ isOpen: false, type: 'all', subjectName: null, message: '' });

    if (type === 'all') {
      setResetting({ __all: true });
      try {
        const token = localStorage.getItem('AccessToken');
        const res = await fetch(`${API_BASE_URL}/student/progress/reset`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setResetOpen(false);
          await fetchProgressData();
          toast.success('Összes tantárgy adatai sikeresen törölve.');
        } else {
          toast.error('Hiba történt a reset során.');
        }
      } catch (err) {
        toast.error('Hiba: ' + err.message);
      } finally {
        setResetting({});
      }
    } else if (type === 'subject' && subjectName) {
      setResetting(prev => ({ ...prev, [subjectName]: true }));
      try {
        const token = localStorage.getItem('AccessToken');
        const res = await fetch(`${API_BASE_URL}/student/progress/reset/${encodeURIComponent(subjectName)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          await fetchProgressData();
          toast.success(`"${subjectName}" adatai sikeresen törölve.`);
        } else {
          toast.error('Hiba történt a reset során.');
        }
      } catch (err) {
        toast.error('Hiba: ' + err.message);
      } finally {
        setResetting(prev => ({ ...prev, [subjectName]: false }));
      }
    }
  };

  if (loading) {
    return (
      <div id="content">
        <div className="subject-select-page">
          <div className="page-header-banner">
            <div className="phb-icon"><FaCompass /></div>
            <div className="phb-text">
              <h1 className="phb-title">Egyéni Gyakorlás</h1>
              <p className="phb-subtitle">Fejleszd tudásodat tárgyankénti szintfelmérőkkel és kihívásokkal</p>
            </div>
          </div>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const xpLevel = Math.floor(stats.totalXP / XP_PER_LEVEL) + 1;
  const xpInLevel = stats.totalXP % XP_PER_LEVEL;
  const levelProgress = (xpInLevel / XP_PER_LEVEL) * 100;
  const xpToNext = XP_PER_LEVEL - xpInLevel;

  const streakLabel = stats.streak >= 7
    ? 'Tűzön vagy! 🔥'
    : stats.streak >= 3
      ? 'Folytasd így!'
      : stats.streak === 0
        ? 'Ma még nem tanultál'
        : `${stats.streak} napos sorozat`;

  const activeSubjects = subjects.filter(s => s.status === 'in_progress' || s.status === 'level_complete').length;

  return (
    <div id="content">
    <div className="subject-select-page">
      <div className="page-header-banner">
        <div className="phb-icon"><FaCompass /></div>
        <div className="phb-text">
          <h1 className="phb-title">Egyéni Gyakorlás</h1>
          <p className="phb-subtitle">Fejleszd tudásodat tárgyankénti szintfelmérőkkel és kihívásokkal</p>
        </div>
      </div>
      <div className="subject-header">

        <div className="xp-stats-grid">
          {/* XP kártya */}
          <div className="xp-stat-card xp">
            <div className="xp-stat-icon-wrap xp-icon-wrap">
              <FaStar />
            </div>
            <div className="xp-stat-body">
              <div className="xp-stat-value">{stats.totalXP} <span className="xp-unit">XP</span></div>
              <div className="xp-stat-label">Tapasztalati pont</div>
              <div className="xp-mini-bar">
                <div className="xp-mini-fill" style={{ width: `${levelProgress}%` }} />
              </div>
              <div className="xp-stat-footer">
                <span className="xp-level-badge"><FaBolt /> Szint {xpLevel}</span>
                <span className="xp-to-next">{xpToNext} XP →</span>
              </div>
            </div>
          </div>

          {/* Streak kártya */}
          <div className={`xp-stat-card streak${stats.streak >= 3 ? ' streak-hot' : ''}`}>
            <div className={`xp-stat-icon-wrap streak-icon-wrap${stats.streak >= 3 ? ' hot' : ''}`}>
              <FaFire />
            </div>
            <div className="xp-stat-body">
              <div className="xp-stat-value">{stats.streak} <span className="xp-unit">nap</span></div>
              <div className="xp-stat-label">Tanulási sorozat</div>
              <div className="streak-dots">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className={`streak-dot${i < (stats.streak > 0 ? ((stats.streak % 7) || 7) : 0) ? ' active' : ''}`} />
                ))}
              </div>
              <div className="xp-stat-footer">
                <span className={`streak-label${stats.streak >= 3 ? ' hot' : ''}`}>{streakLabel}</span>
              </div>
            </div>
          </div>

          {/* Aktív tantárgyak kártya */}
          <div className="xp-stat-card subjects">
            <div className="xp-stat-icon-wrap subjects-icon-wrap">
              📚
            </div>
            <div className="xp-stat-body">
              <div className="xp-stat-value">{activeSubjects} <span className="xp-unit">/{subjectList.length}</span></div>
              <div className="xp-stat-label">Aktív tantárgy</div>
              <div className="xp-mini-bar">
                <div className="xp-mini-fill subjects" style={{ width: `${(activeSubjects / subjectList.length) * 100}%` }} />
              </div>
              <div className="xp-stat-footer">
                <span className="subjects-hint">
                  {activeSubjects === 0 ? 'Kezdj el egy tantárgyat!' : activeSubjects === subjectList.length ? '✓ Minden aktív' : 'Fedezz fel többet!'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="reset-panel-wrap">
        <button className="reset-panel-toggle" onClick={() => setResetOpen(v => !v)}>
          🔄 Teszt reset
          {resetOpen ? <FaChevronUp className="reset-chevron" /> : <FaChevronDown className="reset-chevron" />}
        </button>

        {resetOpen && (
          <div className="reset-panel-content">
            <div className="reset-panel-row">
              <button
                className="reset-all-btn"
                onClick={handleResetAll}
                disabled={!!resetting.__all}
              >
                <FaTrash /> {resetting.__all ? 'Törlés...' : 'Összes törlése'}
              </button>
            </div>

            <div className="reset-subjects-row">
              {subjectList.map(subj => {
                const hasData = subjects.some(s => s.subject === subj.subject);
                return (
                  <button
                    key={subj.subject}
                    className={`reset-subject-btn${!hasData ? ' no-data' : ''}`}
                    onClick={() => hasData && handleResetSubject(subj.subject)}
                    disabled={!hasData || !!resetting[subj.subject]}
                    title={!hasData ? 'Nincs adat ehhez a tantárgyhoz' : `${subj.name} adatainak törlése`}
                  >
                    {resetting[subj.subject] ? '...' : subj.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="subject-grid">
        {subjectList.map((subj) => {
          const status = getSubjectStatus(subj.subject);
          const statusTexts = {
            'not_started': 'Kezdő',
            'requires_diagnostic': 'Felmérő',
            'in_progress': 'Folyamatban',
            'level_complete': 'Befejezve'
          };

          return (
            <div
              key={subj.subject}
              className={`subject-card ${status.status}`}
              onClick={() => handleSubjectClick(subj.subject)}
              style={{ '--accent-color': subj.color }}
            >
              <div className="subject-card-top">
                <div className="subject-icon-wrap">
                  {subj.icon}
                </div>
              </div>
              
              <div className="subject-card-body">
                <h3>{subj.name}</h3>
                <div className="subject-status-row">
                  <span className={`status-label ${status.status}`}>{statusTexts[status.status]}</span>
                  <span className="level-mini-badge">Szint: {status.level}</span>
                </div>
                {status.percentage > 0 && (
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${status.percentage}%` }} />
                  </div>
                )}
                {status.status === 'level_complete' && (
                  <div className="subject-next-level">
                    Következő szint indítása →
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* Custom Reusable Confirm Modal */}
        <ConfirmModal 
            isOpen={confirmResetModal.isOpen}
            title="Haladás visszaállítása"
            message={confirmResetModal.message}
            confirmText="Visszaállítás"
            cancelText="Mégse"
            type="danger"
            onConfirm={executeReset}
            onCancel={() => setConfirmResetModal({ isOpen: false, type: 'all', subjectName: null, message: '' })}
        />
      </div>
    </div>
    </div>
  );
};

export default SubjectSelectPage;
