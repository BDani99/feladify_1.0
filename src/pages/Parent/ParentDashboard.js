import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import {
  FaUserPlus, FaTrophy, FaFire, FaChartLine, FaCheckCircle,
  FaHourglassHalf, FaArrowRight, FaExclamationCircle, FaClock,
  FaChartBar, FaTasks
} from 'react-icons/fa';
import ParentChildSelector from '../../components/ParentChildSelector';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Student/StudentDashboard.css';

const getDaysUntil = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
};

const urgencyClass = (days) => {
  if (days === null) return 'normal';
  if (days <= 1) return 'urgent';
  if (days <= 3) return 'soon';
  if (days <= 7) return 'upcoming';
  return 'normal';
};

const urgencyLabel = (days) => {
  if (days === null) return 'Nincs határidő';
  if (days < 0) return 'Lejárt';
  if (days === 0) return '⚠ Ma jár le';
  if (days === 1) return '⚠ 1 nap';
  return `${days} nap`;
};

const GRADE_COLORS = { 5: '#3b82f6', 4: '#10b981', 3: '#eab308', 2: '#f97316', 1: '#ef4444' };
const GRADE_LABELS = { 5: 'Jeles', 4: 'Jó', 3: 'Közepes', 2: 'Elégséges', 1: 'Elégtelen' };

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser() || {};
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
  const [overview, setOverview] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const now = new Date();
  const greetHour = now.getHours();
  const greeting = greetHour < 12 ? 'Jó reggelt' : greetHour < 18 ? 'Szia' : 'Jó estét';
  const firstName = user?.name ? user.name.trim().split(' ').slice(-1)[0] : 'Szülő';

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await fetch('/api/parent/children', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
        });
        const data = await res.json();
        if (data.children && data.children.length > 0) {
          setChildren(data.children);
          const stored = localStorage.getItem('parent-selected-child');
          if (!stored || !data.children.some(c => c._id === stored)) {
            setSelectedChildId(data.children[0]._id);
            localStorage.setItem('parent-selected-child', data.children[0]._id);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError('Hiba történt a gyermekek betöltésekor.');
        setLoading(false);
      }
    };
    fetchChildren();
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [overviewRes, assignmentsRes] = await Promise.all([
          fetch(`/api/parent/child/${selectedChildId}/overview`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
          }),
          fetch(`/api/parent/child/${selectedChildId}/assignments`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
          })
        ]);
        if (overviewRes.ok) setOverview(await overviewRes.json());
        if (assignmentsRes.ok) {
          const aData = await assignmentsRes.json();
          setAssignments(aData.assignments || []);
        }
      } catch (err) {
        setError('Hiba az adatok lekérésekor.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedChildId]);

  const handleChildChange = (id) => {
    setSelectedChildId(id);
    localStorage.setItem('parent-selected-child', id);
  };

  const deadlines = assignments
    .filter(a => a.status !== 'completed')
    .sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate) : new Date('9999-12-31');
      const db = b.dueDate ? new Date(b.dueDate) : new Date('9999-12-31');
      return da - db;
    });

  const recentGraded = assignments
    .filter(a => a.status === 'completed' && a.grade != null)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 3);

  const inProgress = assignments.filter(a => a.status === 'started');

  if (children.length === 0 && !loading) {
    return (
      <div id="content">
        <div className="dashboard-container">
          <div className="dash-section-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <FaUserPlus style={{ fontSize: '3.5rem', color: 'var(--accent)', marginBottom: 24 }} />
            <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Nincs még összekapcsolt gyermek</h2>
            <p style={{ color: 'var(--color-text-dim)', marginBottom: 24 }}>
              A szülői fiók használatához először hozzá kell adnod gyermekedet a Beállítások menüpontban az e-mail címe alapján.
            </p>
            <button className="dash-primary-action" onClick={() => navigate('/szulo-beallitasok')}>
              Gyermek hozzáadása <FaArrowRight />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="content">
      <div className="dashboard-container">

        <div className="page-header-banner">
          <div className="phb-icon"><FaTasks /></div>
          <div className="phb-text">
            <h1 className="phb-title">{greeting}, {firstName}!</h1>
            <p className="phb-subtitle">Kísérd figyelemmel gyermeked haladását és eredményeit.</p>
          </div>
          {children.length > 0 && (
            <ParentChildSelector
              childrenList={children}
              selectedId={selectedChildId}
              onChange={handleChildChange}
            />
          )}
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Betöltés...</span>
            </div>
          </div>
        ) : error ? (
          <div className="error-state"><FaExclamationCircle /> {error}</div>
        ) : overview && (
          <>
            {/* Stats */}
            <div className="dash-stats-row">
              <div className="dash-stat-card">
                <div className="dash-stat-icon purple"><FaTrophy /></div>
                <div className="dash-stat-body">
                  <div className="dash-stat-value">{overview.stats.totalXP}</div>
                  <div className="dash-stat-label">XP összesen</div>
                </div>
              </div>
              <div className="dash-stat-card">
                <div className="dash-stat-icon orange"><FaFire /></div>
                <div className="dash-stat-body">
                  <div className="dash-stat-value">{overview.stats.streak}</div>
                  <div className="dash-stat-label">Napos sorozat</div>
                </div>
              </div>
              <div className="dash-stat-card">
                <div className="dash-stat-icon blue"><FaChartLine /></div>
                <div className="dash-stat-body">
                  <div className="dash-stat-value">{overview.stats.averageGrade}</div>
                  <div className="dash-stat-label">Átlagos érdemjegy</div>
                </div>
              </div>
              <div className="dash-stat-card">
                <div className="dash-stat-icon green"><FaCheckCircle /></div>
                <div className="dash-stat-body">
                  <div className="dash-stat-value">{overview.stats.completedCount}</div>
                  <div className="dash-stat-label">Megoldott dolgozat</div>
                </div>
              </div>
            </div>

            {/* Upcoming deadlines */}
            <div className="dash-section-card dash-deadlines-section">
              <div className="dash-section-title">
                <FaClock /> Közelgő határidők
                <span className="dash-count-badge">{deadlines.length}</span>
              </div>
              {deadlines.length === 0 ? (
                <div className="dash-empty">
                  <span className="dash-empty-emoji">🎉</span>
                  <p>Nincs közelgő határidő</p>
                  <span className="dash-empty-sub">Gyermeked naprakész minden feladattal!</span>
                </div>
              ) : (
                <div className="dash-deadline-grid">
                  {deadlines.map(a => {
                    const days = getDaysUntil(a.dueDate);
                    const uc = urgencyClass(days);
                    return (
                      <div key={a._id} className={`dash-deadline-card ${uc}`}>
                        <div className="dash-deadline-top">
                          <span className="dash-item-subject">{a.subject}</span>
                          <span className={`dash-deadline-badge ${uc}`}>{urgencyLabel(days)}</span>
                        </div>
                        <div className="dash-deadline-title">{a.title}</div>
                        <div className="dash-deadline-footer">
                          <span className="dash-item-questions">
                            {a.status === 'started' ? '✏ Folyamatban' : 'Nem kezdte el'}
                          </span>
                          <button className="dash-action-btn" onClick={() => navigate('/szulo-teendok')}>
                            Részletek <FaArrowRight />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent grades + in progress */}
            <div className="dash-two-col">
              <div className="dash-section-card">
                <div className="dash-section-title"><FaTrophy /> Friss érdemjegyek</div>
                {recentGraded.length === 0 ? (
                  <div className="dash-empty">
                    <FaChartBar className="dash-empty-icon" />
                    <p>Még nincs értékelt dolgozat</p>
                  </div>
                ) : (
                  <div className="dash-item-list">
                    {recentGraded.map(a => {
                      const gradeNum = Number(a.grade);
                      const pct = a.totalPoints > 0 ? Math.round((a.achievedPoints / a.totalPoints) * 100) : 0;
                      return (
                        <div key={a._id} className="dash-item-row">
                          <div className="dash-item-info">
                            <span className="dash-item-subject">{a.subject}</span>
                            <span className="dash-item-title">{a.title}</span>
                          </div>
                          <div className="dash-item-right">
                            <span className="dash-grade-badge" style={{ background: GRADE_COLORS[gradeNum] || '#6b7280' }}>
                              {gradeNum} – {GRADE_LABELS[gradeNum] || ''}
                            </span>
                            <span className="dash-score-pct">{pct}%</span>
                            <button className="dash-action-btn" onClick={() => navigate('/szulo-eredmenyek')}>
                              <FaArrowRight />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="dash-section-card">
                <div className="dash-section-title"><FaHourglassHalf /> Folyamatban lévő</div>
                {inProgress.length === 0 ? (
                  <div className="dash-empty">
                    <FaCheckCircle className="dash-empty-icon green" />
                    <p>Nincs megkezdett, be nem adott dolgozat</p>
                  </div>
                ) : (
                  <div className="dash-item-list">
                    {inProgress.map(a => (
                      <div key={a._id} className="dash-item-row">
                        <div className="dash-item-info">
                          <span className="dash-item-subject">{a.subject}</span>
                          <span className="dash-item-title">{a.title}</span>
                        </div>
                        <div className="dash-item-right">
                          <span className="dash-pending-badge">Piszkozat</span>
                          <button className="dash-action-btn" onClick={() => navigate('/szulo-teendok')}>
                            <FaArrowRight />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="dash-section-card dash-quick-actions-card">
              <div className="dash-section-title"><FaTasks /> Gyors navigáció</div>
              <div className="dash-quick-actions">
                <button className="dash-primary-action" onClick={() => navigate('/szulo-teendok')}>
                  <FaTasks /> Gyermek Teendők
                </button>
                <button className="dash-secondary-action" onClick={() => navigate('/szulo-eredmenyek')}>
                  <FaTrophy /> Eredmények
                </button>
                <button className="dash-secondary-action" onClick={() => navigate('/szulo-roadmap')}>
                  <FaChartBar /> Fejlődési Térkép
                </button>
                <button className="dash-secondary-action" onClick={() => navigate('/szulo-ai-tanacsado')}>
                  <FaChartLine /> AI Tanácsadó
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default ParentDashboard;
