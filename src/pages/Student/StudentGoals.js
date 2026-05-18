import React, { useState, useEffect, useCallback } from 'react';
import { FaBullseye, FaStar, FaClipboardList, FaTrophy, FaExclamationCircle } from 'react-icons/fa';
import { API_BASE_URL } from '../../api/config';
import LoadingSpinner from '../../components/LoadingSpinner';

import '../../styles/Student/CompletedAssignments.css';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Parent/ParentGoals.css';

const TYPE_META = {
  assignment_avg: { label: 'Dolgozat Átlag', icon: '📝', cardClass: 'type-assignment' },
  practice_xp:    { label: 'XP Célpont',     icon: '⭐', cardClass: 'type-xp' },
  practice_streak:{ label: 'Sorozat',         icon: '🔥', cardClass: 'type-streak' },
};

const subjectDisplay = (s) => s === 'all' ? 'Összes tantárgy' : s;

const getDeadlineInfo = (deadline) => {
  if (!deadline) return null;
  const diffDays = Math.ceil((new Date(deadline) - Date.now()) / 864e5);
  if (diffDays < 0) return { text: 'Lejárt', cls: 'overdue' };
  if (diffDays === 0) return { text: 'Ma jár le', cls: 'near' };
  if (diffDays <= 3) return { text: `${diffDays} nap múlva jár le`, cls: 'near' };
  return {
    text: new Date(deadline).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
    cls: ''
  };
};

/* ── Student Goal Card ── */
const GoalCard = ({ goal }) => {
  const { progress, type, subject, title, periodDays, deadline, parentName } = goal;
  const meta = TYPE_META[type];
  const fillClass = progress.pct >= 100 ? 'pct-high' : progress.pct >= 60 ? 'pct-mid' : 'pct-low';
  const deadlineInfo = deadline ? getDeadlineInfo(deadline) : null;
  const pctColor = progress.pct >= 100 ? '#10b981' : progress.pct >= 60 ? '#3b82f6' : '#f59e0b';

  return (
    <div className={`pg-goal-card ${meta.cardClass}${progress.pct >= 100 ? ' completed' : ''}`}>
      <div className="pg-goal-header">
        <span className="pg-subject-badge">{meta.icon} {subjectDisplay(subject)}</span>
        <span className="pg-goal-title">{title}</span>
      </div>

      <div className="pg-progress-wrap">
        <div className="pg-progress-bar-track">
          <div className={`pg-progress-bar-fill ${fillClass}`} style={{ width: `${progress.pct}%` }} />
        </div>
        <div className="pg-progress-values">
          <span className="pg-progress-current">{progress.current}{progress.unit}</span>
          <span className="pg-progress-target">/ {progress.target}{progress.unit}</span>
          <span className="pg-progress-pct" style={{ color: pctColor }}>{progress.pct}%</span>
        </div>
        {type === 'assignment_avg' && (
          <div className="pg-count-hint">
            {progress.count > 0
              ? `${progress.count} értékelt dolgozat alapján (utolsó ${periodDays} nap)`
              : `Még nincs értékelt dolgozatod az utolsó ${periodDays} napban`}
          </div>
        )}
        {type === 'practice_streak' && (
          <div className="pg-count-hint">Jelenlegi napi sorozatod alapján mérve</div>
        )}
      </div>

      <div className="pg-goal-footer">
        <span className="pg-type-badge">{meta.label}</span>
        {deadlineInfo && (
          <span className={`pg-deadline-badge ${deadlineInfo.cls}`}>📅 {deadlineInfo.text}</span>
        )}
        
        {/* Szülő megjelölése */}
        <span 
          style={{ 
            fontSize: '0.72rem', 
            fontWeight: 700, 
            color: 'var(--color-text-dim)', 
            background: 'var(--bg-input)', 
            padding: '2px 8px', 
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            marginLeft: 'auto'
          }}
        >
          👪 {parentName}
        </span>

        {progress.pct >= 100 && (
          <span className="pg-completed-badge" style={{ marginLeft: 6 }}>
            ✓ Teljesítve
          </span>
        )}
      </div>
    </div>
  );
};

const StudentGoals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetchGoals = useCallback(async () => {
    const token = localStorage.getItem('AccessToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/student/goals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Hiba a célkitűzések lekérésekor.');
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const assignmentGoals = goals.filter(g => g.type === 'assignment_avg');
  const practiceGoals = goals.filter(g => ['practice_xp', 'practice_streak'].includes(g.type));

  const totalActive = goals.filter(g => g.progress.pct < 100).length;
  const totalCompleted = goals.filter(g => g.progress.pct >= 100).length;

  return (
    <div id="content">
      <div className="completed-assignments-wrapper">
        
        {/* Header Banner */}
        <div className="page-header-banner" style={{ marginBottom: 30 }}>
          <div className="phb-icon"><FaBullseye /></div>
          <div className="phb-text">
            <h1 className="phb-title">Célkitűzések</h1>
            <p className="phb-subtitle">Kövesd nyomon a szüleid által neked összeállított motivációs és tanulási célokat!</p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : err ? (
          <div className="pg-empty-section" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            <FaExclamationCircle className="pg-empty-icon" />
            <p>{err}</p>
          </div>
        ) : (
          <>
            {/* Stats Mini Grid */}
            <div className="stats-mini-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 35 }}>
              <div className="mini-stat">
                <div className="stat-label">Függő célok</div>
                <div className="stat-val" style={{ color: '#3b82f6' }}>{totalActive}</div>
              </div>

              <div className="mini-stat">
                <div className="stat-label">Teljesített célok</div>
                <div className="stat-val" style={{ color: '#10b981' }}>{totalCompleted}</div>
              </div>
            </div>

            {/* Dolgozat Célok */}
            <section className="pg-section">
              <div className="pg-section-header">
                <h2 className="pg-section-title">
                  📝 Dolgozat Célok
                </h2>
                <span className="pg-section-count">{assignmentGoals.length}</span>
              </div>

              {assignmentGoals.length === 0 ? (
                <div className="pg-empty-section">
                  <FaClipboardList className="pg-empty-icon" />
                  <strong>Nincs beállítva dolgozat átlag cél</strong>
                  <p>A szüleid még nem tűztek ki dolgozat átlag célt neked.</p>
                </div>
              ) : (
                <div className="pg-goals-grid">
                  {assignmentGoals.map(goal => (
                    <GoalCard key={goal.goalId} goal={goal} />
                  ))}
                </div>
              )}
            </section>

            {/* Gyakorlási Célok */}
            <section className="pg-section" style={{ marginTop: 25 }}>
              <div className="pg-section-header">
                <h2 className="pg-section-title">
                  ⭐ Egyéni Gyakorlási Célok
                </h2>
                <span className="pg-section-count">{practiceGoals.length}</span>
              </div>

              {practiceGoals.length === 0 ? (
                <div className="pg-empty-section">
                  <FaStar className="pg-empty-icon" />
                  <strong>Nincs beállítva egyéni gyakorlási cél</strong>
                  <p>Pl. szerezni valamennyi XP-t egy tantárgyból, vagy napi sorozatot elérni.</p>
                </div>
              ) : (
                <div className="pg-goals-grid">
                  {practiceGoals.map(goal => (
                    <GoalCard key={goal.goalId} goal={goal} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentGoals;
