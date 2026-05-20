import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { fetchAvailableAssignments, fetchCompletedAssignments } from '../../api/Assignments/Student/Assignments';
import { fetchStudentStatistics, fetchPracticeStatistics } from '../../api/Student/Roadmap';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    FaTasks, FaFire, FaClock, FaArrowRight, FaBook,
    FaCheckCircle, FaHourglassHalf, FaExclamationCircle,
    FaGraduationCap, FaChartBar, FaCompass, FaTrophy, FaBullseye,
    FaStar, FaFlask, FaLightbulb, FaChevronUp, FaChevronDown
} from 'react-icons/fa';
import { API_BASE_URL } from '../../api/config';
import '../../styles/Student/StudentDashboard.css';
import '../../styles/Parent/ParentGoals.css';
import '../../styles/Announcements.css';

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

const GRADE_LABELS = { 5: 'Jeles', 4: 'Jó', 3: 'Közepes', 2: 'Elégséges', 1: 'Elégtelen' };
const GRADE_COLORS = { 5: '#3b82f6', 4: '#10b981', 3: '#eab308', 2: '#f97316', 1: '#ef4444' };

const SUBJECT_EMOJIS = {
    'Matematika': '🔢', 'Magyar': '📖', 'Irodalom': '📚', 'Történelem': '🏛️',
    'Fizika': '⚛️', 'Kémia': '🧪', 'Biológia': '🌿', 'Angol': '🇬🇧',
    'Német': '🇩🇪', 'Informatika': '💻', 'Testnevelés': '⚽', 'Rajz': '🎨',
    'Ének': '🎵', 'Földrajz': '🌍'
};

const getSubjectEmoji = (subject) => SUBJECT_EMOJIS[subject] || '📝';

const ScoreBar = ({ score, color }) => (
    <div className="dash-score-bar-track">
        <div
            className="dash-score-bar-fill"
            style={{ width: `${Math.min(score, 100)}%`, background: color || 'var(--accent)' }}
        />
    </div>
);

const scoreColor = (pct) => {
    if (pct >= 80) return '#10b981';
    if (pct >= 60) return '#3b82f6';
    if (pct >= 40) return '#eab308';
    return '#ef4444';
};

const StudentDashboard = () => {
    const navigate = useNavigate();
    const { user } = useUser() || {};
    const [available, setAvailable] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [stats, setStats] = useState(null);
    const [practiceStats, setPracticeStats] = useState(null);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newAssignmentIds, setNewAssignmentIds] = useState(new Set());
    const [showAllSubjects, setShowAllSubjects] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('AccessToken');
        if (!token) return;
        const es = new EventSource(`${API_BASE_URL}/realtime/stream?token=${token}`);
        es.addEventListener('new_assignment', (event) => {
            try {
                const data = JSON.parse(event.data);
                fetchAvailableAssignments().then(avail => {
                    if (Array.isArray(avail)) {
                        setAvailable(avail);
                        if (data.assignmentId) {
                            setNewAssignmentIds(prev => new Set([...prev, data.assignmentId]));
                            setTimeout(() => {
                                setNewAssignmentIds(prev => {
                                    const s = new Set(prev);
                                    s.delete(data.assignmentId);
                                    return s;
                                });
                            }, 8000);
                        }
                    }
                }).catch(() => {});
            } catch {}
        });
        es.onerror = () => {};
        return () => es.close();
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const token = localStorage.getItem('AccessToken');
                const [avail, comp, st, practSt, goalsRes] = await Promise.all([
                    fetchAvailableAssignments(),
                    fetchCompletedAssignments(),
                    fetchStudentStatistics(),
                    fetchPracticeStatistics(),
                    token ? fetch(`${API_BASE_URL}/student/goals`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then(r => r.ok ? r.json() : { goals: [] }).catch(() => ({ goals: [] })) : { goals: [] }
                ]);
                setAvailable(Array.isArray(avail) ? avail : []);
                setCompleted(Array.isArray(comp) ? comp : []);
                setStats(st);
                setPracticeStats(practSt);
                setGoals(goalsRes?.goals || []);
            } catch (err) {
                setError(err.message || 'Hiba a betöltés során.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const now = new Date();
    const today = now.toLocaleDateString('hu-HU', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
    const greetHour = now.getHours();
    const greeting = greetHour < 12 ? 'Jó reggelt' : greetHour < 18 ? 'Szia' : 'Jó estét';

    const firstName = user?.name
        ? user.name.trim().split(' ').slice(-1)[0]
        : 'Diák';

    const deadlines = [...available].sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate) : new Date('9999-12-31');
        const db = b.dueDate ? new Date(b.dueDate) : new Date('9999-12-31');
        return da - db;
    });

    const underReview = completed.filter(a => a.grade == null);
    const activeGoals = goals.filter(g => g.progress.pct < 100);
    const recentGraded = completed
        .filter(a => a.grade != null)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 5);

    // Subject progress from practiceStats
    const subjectStats = practiceStats?.subjectStats || [];
    const diagnostics = practiceStats?.diagnosticBySubject || [];
    const activeSubjects = subjectStats.filter(s => s.completedCheckpoints > 0 || diagnostics.find(d => d.subject === s.subject));
    const displaySubjects = showAllSubjects ? activeSubjects : activeSubjects.slice(0, 4);

    // Strengths & weaknesses from stats
    const strengths = stats?.strengths || [];
    const weaknesses = stats?.weaknesses || [];

    const streakVal = stats?.streak ?? practiceStats?.streak ?? 0;
    const xpVal = stats?.totalXP ?? practiceStats?.totalXP ?? 0;

    return (
        <div id="content">
            <div className="dashboard-container">

                <div className="page-header-banner">
                    <div className="phb-icon"><FaTasks /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">{greeting}, {firstName}!</h1>
                        <p className="phb-subtitle">{today} – Jó tanulást mára! 🚀</p>
                    </div>
                    <div className="dash-header-badges">
                        <span className="dash-streak-chip">
                            <FaFire /> {streakVal} napos sorozat
                        </span>
                        <span className="dash-xp-chip">
                            <FaTrophy /> {xpVal} XP
                        </span>
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : error ? (
                    <div className="error-state"><FaExclamationCircle /> {error}</div>
                ) : (
                <>

                {/* STAT CARDS */}
                <div className="dash-stats-row">
                    <div className="dash-stat-card" onClick={() => navigate('/tanulo-statisztika')} style={{ cursor: 'pointer' }}>
                        <div className="dash-stat-icon orange"><FaFire /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{streakVal}</div>
                            <div className="dash-stat-label">Napos sorozat</div>
                        </div>
                    </div>
                    <div className="dash-stat-card" onClick={() => navigate('/tanulo-statisztika')} style={{ cursor: 'pointer' }}>
                        <div className="dash-stat-icon purple"><FaTrophy /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{xpVal}</div>
                            <div className="dash-stat-label">XP összesen</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon green"><FaCheckCircle /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{completed.length}</div>
                            <div className="dash-stat-label">Megírt dolgozat</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon blue"><FaChartBar /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">
                                {stats?.averageScore != null ? stats.averageScore + '%' : '—'}
                            </div>
                            <div className="dash-stat-label">Átlagos eredmény</div>
                        </div>
                    </div>
                </div>

                {/* DEADLINES */}
                <div className="dash-section-card dash-deadlines-section">
                    <div className="dash-section-title">
                        <FaClock /> Közelgő határidők
                        <span className="dash-count-badge">{deadlines.length}</span>
                        {deadlines.length > 0 && (
                            <Link to="/elerheto-dolgozatok" className="dash-see-all-link">
                                Összes <FaArrowRight />
                            </Link>
                        )}
                    </div>
                    {deadlines.length === 0 ? (
                        <div className="dash-empty">
                            <span className="dash-empty-emoji">🎉</span>
                            <p>Nincs aktuális határidőd</p>
                            <span className="dash-empty-sub">Minden feladattal naprakész vagy!</span>
                        </div>
                    ) : (
                        <div className="dash-deadline-grid">
                            {deadlines.slice(0, 6).map(a => {
                                const days = getDaysUntil(a.dueDate);
                                const uc = urgencyClass(days);
                                const isNew = newAssignmentIds.has(String(a._id));
                                return (
                                    <div key={a._id} className={`dash-deadline-card ${uc}${isNew ? ' ann-new' : ''}`}>
                                        <div className="dash-deadline-top">
                                            <span className="dash-item-subject">
                                                {getSubjectEmoji(a.subject)} {a.subject}
                                            </span>
                                            <span className={`dash-deadline-badge ${uc}`}>
                                                {urgencyLabel(days)}
                                            </span>
                                            {isNew && <span className="ann-new-badge">Új</span>}
                                        </div>
                                        <div className="dash-deadline-title">{a.title}</div>
                                        <div className="dash-deadline-footer">
                                            <span className="dash-item-questions">
                                                {a.questions?.length || 0} kérdés
                                            </span>
                                            <Link
                                                to={`/dolgozat/${a._id}`}
                                                state={{ assignment: a }}
                                                className="dash-start-btn"
                                            >
                                                Kitöltés <FaArrowRight />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* SUBJECT PROGRESS */}
                {activeSubjects.length > 0 && (
                    <div className="dash-section-card">
                        <div className="dash-section-title">
                            <FaBook /> Tantárgyak haladása
                            <span className="dash-count-badge">{activeSubjects.length}</span>
                            <Link to="/tanulo-statisztika" className="dash-see-all-link">
                                Részletek <FaArrowRight />
                            </Link>
                        </div>
                        <div className="dash-subjects-grid">
                            {displaySubjects.map(s => {
                                const diag = diagnostics.find(d => d.subject === s.subject);
                                const pct = s.totalCheckpoints > 0
                                    ? Math.round((s.completedCheckpoints / s.totalCheckpoints) * 100)
                                    : 0;
                                const color = scoreColor(s.avgScore);
                                return (
                                    <div key={s.subject} className="dash-subject-card">
                                        <div className="dash-subject-header">
                                            <span className="dash-subject-emoji">{getSubjectEmoji(s.subject)}</span>
                                            <div className="dash-subject-info">
                                                <span className="dash-subject-name">{s.subject}</span>
                                                <span className="dash-subject-level">Szint {s.currentLevel} · {s.subjectXP} XP</span>
                                            </div>
                                            <span className="dash-subject-score" style={{ color }}>
                                                {s.avgScore > 0 ? s.avgScore + '%' : '—'}
                                            </span>
                                        </div>
                                        <div className="dash-subject-progress-row">
                                            <ScoreBar score={pct} color={color} />
                                            <span className="dash-subject-pct-label">
                                                {s.completedCheckpoints}/{s.totalCheckpoints} fejezet
                                            </span>
                                        </div>
                                        {diag && (
                                            <div className="dash-subject-diag">
                                                <FaFlask /> Szintfelmérő: <strong style={{ color: scoreColor(diag.scorePercentage) }}>{Math.round(diag.scorePercentage)}%</strong>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {activeSubjects.length > 4 && (
                            <button
                                className="dash-toggle-btn"
                                onClick={() => setShowAllSubjects(v => !v)}
                            >
                                {showAllSubjects ? <><FaChevronUp /> Kevesebb</> : <><FaChevronDown /> Mind a {activeSubjects.length} tantárgy</>}
                            </button>
                        )}
                    </div>
                )}

                {/* STRENGTHS & WEAKNESSES */}
                {(strengths.length > 0 || weaknesses.length > 0) && (
                    <div className="dash-two-col">
                        {strengths.length > 0 && (
                            <div className="dash-section-card">
                                <div className="dash-section-title" style={{ color: '#10b981' }}>
                                    <FaStar /> Erős területek
                                </div>
                                <div className="dash-insight-list">
                                    {strengths.map(t => (
                                        <div key={t.topic} className="dash-insight-row strength">
                                            <span className="dash-insight-emoji">{getSubjectEmoji(t.topic)}</span>
                                            <span className="dash-insight-label">{t.topic}</span>
                                            <span className="dash-insight-score" style={{ color: scoreColor(t.averageScore) }}>
                                                {t.averageScore}%
                                            </span>
                                            <ScoreBar score={t.averageScore} color="#10b981" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {weaknesses.length > 0 && (
                            <div className="dash-section-card">
                                <div className="dash-section-title" style={{ color: '#f97316' }}>
                                    <FaLightbulb /> Fejlesztendő területek
                                </div>
                                <div className="dash-insight-list">
                                    {weaknesses.map(t => (
                                        <div key={t.topic} className="dash-insight-row weakness">
                                            <span className="dash-insight-emoji">{getSubjectEmoji(t.topic)}</span>
                                            <span className="dash-insight-label">{t.topic}</span>
                                            <span className="dash-insight-score" style={{ color: scoreColor(t.averageScore) }}>
                                                {t.averageScore}%
                                            </span>
                                            <ScoreBar score={t.averageScore} color="#f97316" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* GOALS */}
                <div className="dash-section-card">
                    <div className="dash-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 15 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FaBullseye style={{ color: '#f43f5e' }} /> Szülői célkitűzések
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="dash-count-badge">{activeGoals.length}</span>
                            {activeGoals.length > 0 && (
                                <button
                                    className="dash-see-all-link-btn"
                                    onClick={() => navigate('/szulo-celok')}
                                >
                                    Összes <FaArrowRight />
                                </button>
                            )}
                        </div>
                    </div>

                    {activeGoals.length === 0 ? (
                        <div className="dash-empty" style={{ padding: '30px 20px' }}>
                            <span className="dash-empty-emoji">🎯</span>
                            <p>Nincsenek aktív szülői célkitűzéseid.</p>
                            <span className="dash-empty-sub">Szólj a szüleidnek, hogy tűzzenek ki motivációs célokat!</span>
                        </div>
                    ) : (
                        <div className="pg-goals-grid">
                            {activeGoals.slice(0, 3).map(goal => {
                                const pct = goal.progress?.pct ?? 0;
                                const typeClass = goal.type === 'assignment_avg' ? 'type-assignment' : goal.type === 'practice_xp' ? 'type-xp' : 'type-streak';
                                const fillColor = pct >= 100 ? '#10b981' : pct >= 60 ? '#3b82f6' : '#f59e0b';
                                const barClass = pct >= 100 ? 'pct-high' : pct >= 60 ? 'pct-mid' : 'pct-low';
                                const displaySub = goal.subject === 'all' ? 'Összes tantárgy' : goal.subject;
                                const displayType = goal.type === 'assignment_avg' ? 'Dolgozat Átlag' : goal.type === 'practice_xp' ? 'XP Célpont' : 'Sorozat';
                                return (
                                    <div key={goal.goalId} className={`pg-goal-card ${typeClass}`}>
                                        <div className="pg-goal-header">
                                            <span className="pg-subject-badge">{displaySub}</span>
                                            <span className="pg-type-badge">{displayType}</span>
                                        </div>
                                        <div className="pg-goal-title">{goal.title}</div>
                                        <div className="pg-progress-wrap">
                                            <div className="pg-progress-bar-track">
                                                <div className={`pg-progress-bar-fill ${barClass}`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="pg-progress-values">
                                                <span className="pg-progress-current">{goal.progress?.current ?? 0}{goal.progress?.unit ?? ''}</span>
                                                <span className="pg-progress-target"> / {goal.progress?.target ?? 0}{goal.progress?.unit ?? ''}</span>
                                                <span className="pg-progress-pct" style={{ color: fillColor }}>{pct}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RECENT RESULTS + UNDER REVIEW */}
                <div className="dash-two-col">
                    <div className="dash-section-card">
                        <div className="dash-section-title">
                            <FaTrophy /> Friss eredmények
                            {recentGraded.length > 0 && (
                                <Link to="/megoldott-dolgozatok" className="dash-see-all-link">
                                    Összes <FaArrowRight />
                                </Link>
                            )}
                        </div>
                        {recentGraded.length === 0 ? (
                            <div className="dash-empty">
                                <FaGraduationCap className="dash-empty-icon" />
                                <p>Még nincs értékelt dolgozatod</p>
                            </div>
                        ) : (
                            <div className="dash-item-list">
                                {recentGraded.map(a => {
                                    const scorePercent = a.totalPoints
                                        ? Math.round((a.achievedPoints / a.totalPoints) * 100)
                                        : 0;
                                    const gradeNum = Number(a.grade);
                                    return (
                                        <div key={a._id} className="dash-item-row">
                                            <div className="dash-item-info">
                                                <span className="dash-item-subject">
                                                    {getSubjectEmoji(a.subject)} {a.subject}
                                                </span>
                                                <span className="dash-item-title">{a.title}</span>
                                                <ScoreBar score={scorePercent} color={scoreColor(scorePercent)} />
                                            </div>
                                            <div className="dash-item-right">
                                                <span
                                                    className="dash-grade-badge"
                                                    style={{ background: GRADE_COLORS[gradeNum] || '#6b7280' }}
                                                >
                                                    {gradeNum} – {GRADE_LABELS[gradeNum] || ''}
                                                </span>
                                                <span className="dash-score-pct">{scorePercent}%</span>
                                                <Link
                                                    to={`/megoldott-dolgozatok/${a._id}`}
                                                    state={{ assignment: a }}
                                                    className="dash-action-btn"
                                                >
                                                    <FaArrowRight />
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="dash-section-card">
                        <div className="dash-section-title"><FaHourglassHalf /> Javítás alatt</div>
                        {underReview.length === 0 ? (
                            <div className="dash-empty">
                                <FaCheckCircle className="dash-empty-icon green" />
                                <p>Nincs javítás alatt lévő dolgozat</p>
                            </div>
                        ) : (
                            <div className="dash-item-list">
                                {underReview.map(a => (
                                    <div key={a._id} className="dash-item-row">
                                        <div className="dash-item-info">
                                            <span className="dash-item-subject">
                                                {getSubjectEmoji(a.subject)} {a.subject}
                                            </span>
                                            <span className="dash-item-title">{a.title}</span>
                                            <span className="dash-pending-sub">
                                                Beadva: {new Date(a.completedAt).toLocaleDateString('hu-HU')}
                                            </span>
                                        </div>
                                        <div className="dash-item-right">
                                            <span className="dash-pending-badge">Javítás alatt</span>
                                            <Link
                                                to={`/megoldott-dolgozatok/${a._id}`}
                                                state={{ assignment: a }}
                                                className="dash-action-btn"
                                            >
                                                <FaArrowRight />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* QUICK ACTIONS */}
                <div className="dash-section-card dash-quick-actions-card">
                    <div className="dash-section-title"><FaTasks /> Gyors műveletek</div>
                    <div className="dash-quick-actions">
                        <button
                            className="dash-primary-action"
                            onClick={() => navigate('/elerheto-dolgozatok')}
                        >
                            <FaGraduationCap /> Elérhető dolgozatok
                        </button>
                        <button
                            className="dash-secondary-action"
                            onClick={() => navigate('/egyeni-gyakorlas')}
                        >
                            <FaCompass /> Egyéni gyakorlás
                        </button>
                        <button
                            className="dash-secondary-action"
                            onClick={() => navigate('/tanulo-statisztika')}
                        >
                            <FaChartBar /> Részletes statisztika
                        </button>
                        <button
                            className="dash-secondary-action"
                            onClick={() => navigate('/ai-tanar')}
                        >
                            <FaLightbulb /> AI Tanár
                        </button>
                    </div>
                </div>

                </>
                )}

            </div>
        </div>
    );
};

export default StudentDashboard;
