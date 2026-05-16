import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../api/config';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaLock, FaPlay, FaCheck, FaTrophy, FaStar, FaFire } from 'react-icons/fa';
import '../../styles/Student/RoadmapView.css';

const XP_PER_LEVEL = 50;

const RoadmapView = () => {
  const { subject } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalXP: 0, subjectXP: 0, progress: 0, status: 'in_progress', currentLevel: 1 });
  const [xpFlash, setXpFlash] = useState(false);

  useEffect(() => {
    fetchRoadmap();
  }, [subject]);

  useEffect(() => {
    if (!loading && location.state?.xpEarned) {
      setXpFlash(true);
      const t = setTimeout(() => setXpFlash(false), 3500);
      return () => clearTimeout(t);
    }
  }, [loading, location.state]);

  const fetchRoadmap = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/student/roadmap/${subject}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCheckpoints(data.checkpoints || []);
        const completed = (data.checkpoints || []).filter(cp => cp.status === 'completed').length;
        const progress = data.checkpoints ? (completed / data.checkpoints.length) * 100 : 0;
        setStats({ totalXP: data.totalXP || 0, subjectXP: data.subjectXP || 0, progress, status: data.status || 'in_progress', currentLevel: data.currentLevel || 1 });
      }
    } catch (err) {
      console.error('Hiba a roadmap lekérésekor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCheckpoint = (checkpointId) => {
    navigate(`/egyeni-gyakorlas/${subject}/checkpoint/${checkpointId}`);
  };

  if (loading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  const completedCount = checkpoints.filter(cp => cp.status === 'completed').length;
  const totalCount = checkpoints.length;
  const completedWithScore = checkpoints.filter(cp => cp.status === 'completed' && typeof cp.score === 'number');
  const averageScore = completedWithScore.length > 0
    ? Math.round(completedWithScore.reduce((sum, cp) => sum + cp.score, 0) / completedWithScore.length)
    : null;
  const xpLevel = Math.floor(stats.totalXP / XP_PER_LEVEL) + 1;
  const xpInLevel = stats.totalXP % XP_PER_LEVEL;
  const levelProgress = (xpInLevel / XP_PER_LEVEL) * 100;
  const xpToNext = XP_PER_LEVEL - xpInLevel;
  const xpEarnedNow = location.state?.xpEarned;

  return (
    <div id="content">
    <div className="roadmap-view">
      <div className="page-top-bar">
        <button className="back-btn" onClick={() => navigate('/egyeni-gyakorlas')}>
          <FaArrowLeft /> Vissza
        </button>
      </div>

      <div className="roadmap-header">
        <h1>{subject} Tanulási Út</h1>

        {xpFlash && xpEarnedNow && (
          <div className="xp-toast">
            <FaStar className="xp-toast-star" /> +{xpEarnedNow} XP megszerzve!
          </div>
        )}

        <div className="roadmap-stats">
          {/* XP kártya */}
          <div className={`stat-card xp-card${xpFlash ? ' xp-flash' : ''}`}>
            <div className="stat-card-icon">⭐</div>
            <div className="stat-card-body">
              <div className="stat-card-value xp-value">{stats.subjectXP} XP</div>
              <div className="stat-card-label">{subject} – tantárgyi tapasztalat</div>
              <div className="xp-total-row">
                <span className="xp-total-label">Összesen:</span>
                <span className="xp-total-value">{stats.totalXP} XP</span>
              </div>
              <div className="level-bar-wrap">
                <div className="level-bar-fill" style={{ width: `${levelProgress}%` }} />
              </div>
              <div className="level-bar-info">
                <span className="level-badge"><FaFire /> Szint {xpLevel}</span>
                <span className="level-next">{xpToNext} XP a következő szinthez</span>
              </div>
            </div>
          </div>

          {/* Haladás kártya */}
          <div className="stat-card chapters-card">
            <div className="stat-card-icon">🎯</div>
            <div className="stat-card-body">
              <div className="stat-card-value">{completedCount}<span className="stat-total">/{totalCount}</span></div>
              <div className="stat-card-label">Fejezet teljesítve</div>
              <div className="level-bar-wrap">
                <div className="level-bar-fill chapters" style={{ width: `${stats.progress}%` }} />
              </div>
              <div className="level-bar-info">
                <span className="progress-pct">{Math.round(stats.progress)}% kész</span>
              </div>
            </div>
          </div>

          {/* Átlag pontszám kártya – csak ha van teljesített fejezet */}
          {averageScore !== null ? (
            <div className="stat-card score-card">
              <div className="stat-card-icon"><FaTrophy /></div>
              <div className="stat-card-body">
                <div className={`stat-card-value score-value ${averageScore >= 80 ? 'good' : 'low'}`}>{averageScore}%</div>
                <div className="stat-card-label">Átlag pontszám</div>
                <div className="score-bar-wrap">
                  <div className="score-bar-fill" style={{ width: `${averageScore}%`, background: averageScore >= 80 ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#f59e0b,#d97706)' }} />
                </div>
                <div className="level-bar-info">
                  <span className={`score-badge ${averageScore >= 80 ? 'good' : 'low'}`}>
                    {averageScore >= 80 ? '✓ Jó teljesítmény' : '↑ Van hova fejlődni'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="stat-card score-card empty">
              <div className="stat-card-icon"><FaTrophy /></div>
              <div className="stat-card-body">
                <div className="stat-card-value empty-value">–</div>
                <div className="stat-card-label">Átlag pontszám</div>
                <div className="empty-hint">Teljesíts egy fejezetet!</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {stats.status === 'level_complete' && (
        <div className="level-complete-banner">
          <div className="level-complete-icon">🏆</div>
          <div className="level-complete-body">
            <h2>Gratulálunk! Teljesítetted a {stats.currentLevel}. szint összes fejezetét!</h2>
            <p>Készen állsz a következő szintre? Indíts egy nehezebb szintfelmérőt!</p>
            <button
              className="next-level-btn"
              onClick={() => navigate(`/egyeni-gyakorlas/${subject}`, { state: { fromLevelComplete: true } })}
            >
              {stats.currentLevel + 1}. szint indítása →
            </button>
          </div>
        </div>
      )}

      <div className="checkpoints-list">
        {checkpoints.map((checkpoint, index) => (
          <div
            key={checkpoint.checkpointId}
            className={`checkpoint-card ${checkpoint.status}`}
            onClick={() => checkpoint.status === 'unlocked' && handleStartCheckpoint(checkpoint.checkpointId)}
          >
            <div className="checkpoint-icon">
              {checkpoint.status === 'completed' && <FaCheck />}
              {checkpoint.status === 'unlocked' && <FaPlay />}
              {checkpoint.status === 'locked' && <FaLock />}
            </div>

            <div className="checkpoint-content">
              <div className="checkpoint-number">
                {checkpoint.gamifiedTitle || `${index + 1}. Fejezet`}
              </div>

              <div className="checkpoint-meta">
                <span className="difficulty">
                  Nehézség: {checkpoint.difficulty}/5
                </span>
                {checkpoint.status === 'completed' && (
                  <span className="score">Pontszám: {checkpoint.score}%</span>
                )}
                {checkpoint.status === 'locked' && (
                  <span className="locked-msg">Zárolva – teljesítsd az előzőt</span>
                )}
              </div>
            </div>

            {checkpoint.status === 'unlocked' && (
              <button className="start-btn" onClick={(e) => { e.stopPropagation(); handleStartCheckpoint(checkpoint.checkpointId); }}>
                Megkezdés
              </button>
            )}

            {checkpoint.status === 'completed' && (
              <div className="completion-badge">
                <FaTrophy /> Teljesítve
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
    </div>
  );
};

export default RoadmapView;
