import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../api/config';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaBook, FaTrophy, FaStar, FaChevronDown, FaChevronUp, FaCheck, FaLock } from 'react-icons/fa';
import '../../styles/Student/PracticeHub.css';

const GRADE_OPTIONS = ['1. osztály','2. osztály','3. osztály','4. osztály','5. osztály','6. osztály','7. osztály','8. osztály'];

const PracticeHub = () => {
  const { subject } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const [status, setStatus] = useState('not_started');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [checkpoints, setCheckpoints] = useState([]);
  const [totalXP, setTotalXP] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startingDiagnostic, setStartingDiagnostic] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(user?.className || '4. osztály');
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [natTopics, setNatTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => { fetchSubjectStatus(); }, [subject]);

  useEffect(() => {
    const fetchTopics = async () => {
      const gradeMatch = selectedGrade.match(/^(\d+)/);
      const gradeNum = gradeMatch ? parseInt(gradeMatch[1], 10) : null;
      
      const isCurriculumSupported = (sub) => {
        if (!sub) return false;
        const s = sub.toLowerCase();
        return ['matematika', 'nyelvtan', 'irodalom', 'történelem', 'környezetismeret',
                'fizika', 'biológia', 'biologia', 'földrajz', 'foldrajz', 'angol', 'német', 'nemet'].includes(s);
      };

      if (subject && isCurriculumSupported(subject) && gradeNum) {
        setLoadingTopics(true);
        try {
          const response = await fetch(`${API_BASE_URL}/curriculum/topics?subject=${encodeURIComponent(subject)}&grade=${gradeNum}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.available && Array.isArray(data.topics)) {
              setNatTopics(data.topics);
              setSelectedTopics([]);
            } else {
              setNatTopics([]);
              setSelectedTopics([]);
            }
          } else {
            setNatTopics([]);
            setSelectedTopics([]);
          }
        } catch (err) {
          console.error('Error fetching NAT topics:', err);
          setNatTopics([]);
          setSelectedTopics([]);
        } finally {
          setLoadingTopics(false);
        }
      } else {
        setNatTopics([]);
        setSelectedTopics([]);
      }
    };
    fetchTopics();
  }, [subject, selectedGrade]);

  const fetchSubjectStatus = async () => {
    try {
      const token = localStorage.getItem('AccessToken');
      const res = await fetch(`${API_BASE_URL}/student/progress/${subject}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const currentStatus = data.status || 'not_started';
        const hasRoadmap = data.checkpoints && data.checkpoints.length > 0;
        setStatus(currentStatus);
        setCurrentLevel(data.currentLevel || 1);
        setCheckpoints(data.checkpoints || []);
        setTotalXP(data.totalXP || 0);
        if (hasRoadmap && currentStatus !== 'level_complete') {
          navigate(`/egyeni-gyakorlas/${subject}/roadmap`);
          return;
        }
      }
    } catch (err) {
      console.error('Hiba a status lekéréskor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDiagnostic = async () => {
    if (startingDiagnostic) return;
    setStartingDiagnostic(true);
    try {
      const token = localStorage.getItem('AccessToken');
      const res = await fetch(`${API_BASE_URL}/student/diagnostic/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade: selectedGrade, selectedTopics })
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/egyeni-gyakorlas/${subject}/teszt`, { state: { testId: data.testId, questions: data.questions } });
      } else {
        const err = await res.json();
        alert(`Hiba: ${err.message || 'Ismeretlen hiba'}`);
        setStartingDiagnostic(false);
      }
    } catch (err) {
      alert('Hiba: ' + err.message);
      setStartingDiagnostic(false);
    }
  };

  const handleTopicToggle = (topicId) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const renderTopicSelector = () => {
    if (loadingTopics) {
      return (
        <div className="hub-topics-loading">
          <span className="hub-topics-spinner" />
          <span>Témakörök betöltése...</span>
        </div>
      );
    }
    if (natTopics.length === 0) return null;

    return (
      <div className="hub-topic-selector">
        <h3 className="hub-topic-title">🎯 Választható témakörök (opcionális)</h3>
        <p className="hub-topic-subtitle">Válassz ki konkrét témaköröket a szintfelmérőhöz, vagy hagyd üresen az összes témakör felméréséhez.</p>
        <div className="hub-topics-grid">
          {natTopics.map(topic => {
            const isSelected = selectedTopics.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                className={`hub-topic-chip${isSelected ? ' selected' : ''}`}
                onClick={() => handleTopicToggle(topic.id)}
              >
                <span className="hub-topic-chip-icon">{isSelected ? '✓' : '+'}</span>
                <span className="hub-topic-chip-name">{topic.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div id="content">
        <div className="practice-hub practice-hub--full">
          <div className="page-top-bar">
            <button className="back-btn" onClick={() => navigate('/egyeni-gyakorlas')}>
              <FaArrowLeft /> Vissza
            </button>
          </div>
          <div className="diag-layout">
            <div className="diag-info">
              <div className="diag-subject-badge">
                <FaBook />
                <span>{subject}</span>
              </div>
              <h1 className="diag-title">Szintfelmérő</h1>
            </div>
          </div>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const needsDiagnostic = status === 'not_started' || status === 'requires_diagnostic';
  const isLevelComplete = status === 'level_complete';

  const completedCps = checkpoints.filter(c => c.status === 'completed');
  const avgScore = completedCps.length
    ? Math.round(completedCps.reduce((s, c) => s + (c.score || 0), 0) / completedCps.length)
    : 0;
  const bestScore = completedCps.length
    ? Math.max(...completedCps.map(c => c.score || 0))
    : 0;
  const levelXP = completedCps.reduce((s, c) => s + 30 + (c.difficulty || 3) * 8 + Math.floor((c.score || 0) * 0.5), 0) + 100;
  // Minden checkpoint 10 kérdés; helyes válaszok becsülése score%-ból
  const totalQuestionsAnswered = completedCps.length * 10;
  const totalCorrect = completedCps.reduce((s, c) => s + Math.round((c.score || 0) / 100 * 10), 0);

  /* ──────────────── LEVEL COMPLETE ──────────────── */
  if (isLevelComplete) {
    return (
      <div id="content">
        <div className="practice-hub practice-hub--full">
          <div className="page-top-bar">
            <button className="back-btn" onClick={() => navigate('/egyeni-gyakorlas')}>
              <FaArrowLeft /> Vissza
            </button>
          </div>

          {/* Hero */}
          <div className="lc-hero">
            <div className="lc-trophy-wrap">
              <FaTrophy className="lc-trophy" />
              <div className="lc-glow" />
            </div>
            <div className="lc-badge">{currentLevel}. szint</div>
            <h1 className="lc-title">{subject} – szint teljesítve!</h1>
            <p className="lc-subtitle">Minden fejezetet teljesítettél ezen a szinten. Kiváló munka!</p>
          </div>

          {/* Stats sor */}
          <div className="lc-stats">
            <div className="lc-stat-card">
              <span className="lc-stat-icon">🎯</span>
              <span className="lc-stat-value">{avgScore}%</span>
              <span className="lc-stat-label">Átlag pontszám</span>
            </div>
            <div className="lc-stat-card highlight">
              <span className="lc-stat-icon">🏆</span>
              <span className="lc-stat-value">{bestScore}%</span>
              <span className="lc-stat-label">Legjobb fejezet</span>
            </div>
            <div className="lc-stat-card">
              <span className="lc-stat-icon">✅</span>
              <span className="lc-stat-value">{totalCorrect}<span style={{ fontSize: '1.1rem', fontWeight: 700, opacity: 0.5 }}>/{totalQuestionsAnswered}</span></span>
              <span className="lc-stat-label">Helyes válasz</span>
            </div>
            <div className="lc-stat-card">
              <span className="lc-stat-icon xp-icon">⭐</span>
              <span className="lc-stat-value xp-val">+{levelXP}</span>
              <span className="lc-stat-label">XP ezen a szinten</span>
            </div>
          </div>

          {/* Korábbi fejezetek – kinyitható */}
          <div className="lc-chapters">
            <button className="lc-chapters-toggle" onClick={() => setChaptersOpen(v => !v)}>
              <span>Korábbi fejezetek részletei</span>
              {chaptersOpen ? <FaChevronUp /> : <FaChevronDown />}
            </button>
            {chaptersOpen && (
              <div className="lc-chapters-list">
                {checkpoints.map((cp, i) => (
                  <div key={cp.checkpointId} className={`lc-chapter-row ${cp.status}`}>
                    <span className="lc-chapter-num">{i + 1}. Fejezet</span>
                    <div className="lc-chapter-bar-wrap">
                      <div
                        className="lc-chapter-bar"
                        style={{ width: `${cp.score || 0}%`, background: (cp.score || 0) >= 80 ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#f59e0b,#d97706)' }}
                      />
                    </div>
                    <span className="lc-chapter-score">
                      {cp.status === 'completed' ? `${cp.score}%` : <FaLock />}
                    </span>
                    {cp.status === 'completed' && <FaCheck className="lc-check" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Következő szint indítása */}
          <div className="lc-next">
            <div className="lc-next-label">
              <FaStar className="lc-star" />
              <span>Következő szint: <strong>{currentLevel + 1}</strong></span>
            </div>
            <p className="lc-next-hint">A szintfelmérő nehezebb kérdéseket tartalmaz majd.</p>

            {renderTopicSelector()}

            <div className="lc-next-controls">
              <div className="grade-selector">
                <label htmlFor="grade-lc">Osztályfok:</label>
                <select
                  id="grade-lc"
                  value={selectedGrade}
                  onChange={e => setSelectedGrade(e.target.value)}
                >
                  {GRADE_OPTIONS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>

              <button
                className="lc-start-btn"
                onClick={handleStartDiagnostic}
                disabled={startingDiagnostic}
              >
                {startingDiagnostic
                  ? <><span className="lc-spinner" />Kérdések generálása...</>
                  : <>{currentLevel + 1}. szint szintfelmérő indítása →</>}
              </button>
            </div>
            {startingDiagnostic && (
              <p className="generating-hint">Az AI személyre szabja a feladatokat... (~15 mp)</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ──────────────── DIAGNOSTIC START ──────────────── */
  return (
    <div id="content">
      <div className="practice-hub practice-hub--full">
        <div className="page-top-bar">
          <button className="back-btn" onClick={() => navigate('/egyeni-gyakorlas')}>
            <FaArrowLeft /> Vissza
          </button>
        </div>

        <div className="diag-layout">
          {/* Bal: info */}
          <div className="diag-info">
            <div className="diag-subject-badge">
              <FaBook />
              <span>{subject}</span>
            </div>
            <h1 className="diag-title">Szintfelmérő</h1>
            <p className="diag-desc">
              Mielőtt elkezded a gyakorlást, mérjük fel a tudásod!
              A szintfelmérő alapján személyre szabott tanulási utat készítünk számodra.
            </p>

            <div className="diag-chips">
              <span className="diag-chip">📋 ~10 kérdés</span>
              <span className="diag-chip">⏱ ~10 perc</span>
              <span className="diag-chip">🎯 6 feladattípus</span>
              <span className="diag-chip">🤖 AI személyre szabva</span>
            </div>

            <div className="diag-steps">
              <div className="diag-step"><span>1</span><p>Megválaszolod a kérdéseket</p></div>
              <div className="diag-step"><span>2</span><p>Az AI elemzi az eredményeidet</p></div>
              <div className="diag-step"><span>3</span><p>Személyre szabott fejezetek generálódnak</p></div>
            </div>
          </div>

          {/* Jobb: akció */}
          <div className="diag-action">
            <div className="diag-action-card">
              <h2>Indítás előtt</h2>

              <div className="grade-selector">
                <label htmlFor="grade-diag">Osztályfok:</label>
                <select
                  id="grade-diag"
                  value={selectedGrade}
                  onChange={e => setSelectedGrade(e.target.value)}
                >
                  {GRADE_OPTIONS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>

              {renderTopicSelector()}

              <button
                className="start-btn"
                onClick={handleStartDiagnostic}
                disabled={startingDiagnostic}
              >
                {startingDiagnostic ? '⏳ Generálás...' : 'Szintfelmérő indítása'}
              </button>
              {startingDiagnostic && (
                <p className="generating-hint">Az AI most személyre szabja a feladatokat... (~15 mp)</p>
              )}

              <p className="diag-note">
                A szintfelmérő eredménye alapján az AI <strong>5–8 személyre szabott fejezetet</strong> hoz létre számodra.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeHub;
