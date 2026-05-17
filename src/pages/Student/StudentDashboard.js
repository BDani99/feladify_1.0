import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { fetchAvailableAssignments, fetchCompletedAssignments } from '../../api/Assignments/Student/Assignments';
import { fetchStudentStatistics } from '../../api/Student/Roadmap';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    FaTasks, FaFire, FaClock, FaArrowRight, FaBook,
    FaCheckCircle, FaHourglassHalf, FaExclamationCircle,
    FaGraduationCap, FaChartBar, FaCompass, FaTrophy
} from 'react-icons/fa';
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

const GRADE_LABELS = { 5: 'Jeles', 4: 'Jó', 3: 'Közepes', 2: 'Elégséges', 1: 'Elégtelen' };
const GRADE_COLORS = { 5: '#10b981', 4: '#3b82f6', 3: '#eab308', 2: '#f97316', 1: '#ef4444' };

const StudentDashboard = () => {
    const navigate = useNavigate();
    const { user } = useUser() || {};
    const [available, setAvailable] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const [avail, comp, st] = await Promise.all([
                    fetchAvailableAssignments(),
                    fetchCompletedAssignments(),
                    fetchStudentStatistics(),
                ]);
                setAvailable(Array.isArray(avail) ? avail : []);
                setCompleted(Array.isArray(comp) ? comp : []);
                setStats(st);
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
    const recentGraded = completed
        .filter(a => a.grade != null)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 3);

    return (
        <div id="content">
            <div className="dashboard-container">

                <div className="page-header-banner">
                    <div className="phb-icon"><FaTasks /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">{greeting}, {firstName}!</h1>
                        <p className="phb-subtitle">Üdvözlünk újra a Feladify-ban! Jó tanulást mára.</p>
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : error ? (
                    <div className="error-state"><FaExclamationCircle /> {error}</div>
                ) : (
                <>
                <div className="dash-stats-row">
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon orange"><FaFire /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{stats?.streak ?? 0}</div>
                            <div className="dash-stat-label">Napos sorozat</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon purple"><FaTrophy /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{stats?.totalXP ?? 0}</div>
                            <div className="dash-stat-label">XP összesen</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon green"><FaCheckCircle /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">
                                {stats?.completedAssignments ?? recentGraded.length}
                            </div>
                            <div className="dash-stat-label">Értékelt dolgozat</div>
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

                <div className="dash-section-card dash-deadlines-section">
                    <div className="dash-section-title">
                        <FaClock /> Közelgő határidők
                        <span className="dash-count-badge">{deadlines.length}</span>
                    </div>
                    {deadlines.length === 0 ? (
                        <div className="dash-empty">
                            <span className="dash-empty-emoji">🎉</span>
                            <p>Nincs aktuális határidőd</p>
                            <span className="dash-empty-sub">Minden feladattal naprakész vagy!</span>
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
                                            <span className={`dash-deadline-badge ${uc}`}>
                                                {urgencyLabel(days)}
                                            </span>
                                        </div>
                                        <div className="dash-deadline-title">{a.title}</div>
                                        <div className="dash-deadline-footer">
                                            <span className="dash-item-questions">
                                                {a.questions?.length || 0} feladat
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

                <div className="dash-two-col">
                    <div className="dash-section-card">
                        <div className="dash-section-title"><FaTrophy /> Friss eredmények</div>
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
                                                <span className="dash-item-subject">{a.subject}</span>
                                                <span className="dash-item-title">{a.title}</span>
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
                                            <span className="dash-item-subject">{a.subject}</span>
                                            <span className="dash-item-title">{a.title}</span>
                                        </div>
                                        <div className="dash-item-right">
                                            <span className="dash-pending-badge">Folyamatban</span>
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
                            <FaChartBar /> Statisztika
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
