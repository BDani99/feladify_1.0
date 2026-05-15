import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { fetchAssignments } from '../../api/Assignments/Teacher/Assignments';
import { fetchTeacherStatistics } from '../../api/Assignments/Teacher/Statistics';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    FaTachometerAlt, FaClipboard, FaClock, FaChartBar, FaUsers,
    FaPlus, FaArrowRight, FaCheckCircle, FaExclamationCircle,
    FaBrain, FaCalendarAlt
} from 'react-icons/fa';
import '../../styles/Teacher/TeacherDashboard.css';

const getDaysUntil = (d) => {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / 86400000);
};

const urgencyClass = (days) => {
    if (days <= 1) return 'urgent';
    if (days <= 3) return 'soon';
    if (days <= 7) return 'upcoming';
    return 'normal';
};

const urgencyLabel = (days) => {
    if (days < 0) return 'Lejárt';
    if (days === 0) return 'Ma jár le';
    if (days === 1) return '1 nap';
    return `${days} nap`;
};

const TeacherDashboard = () => {
    const navigate = useNavigate();
    const { user } = useUser() || {};
    const [assignments, setAssignments] = useState([]);
    const [stats, setStats] = useState(null);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const [asgn, st, cls] = await Promise.all([
                    fetchAssignments(),
                    fetchTeacherStatistics(),
                    fetchTeacherClasses(),
                ]);
                setAssignments(Array.isArray(asgn) ? asgn : []);
                setStats(st);
                setClasses(Array.isArray(cls) ? cls : []);
            } catch (err) {
                setError(err.message || 'Hiba a betöltés során.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div id="content"><LoadingSpinner /></div>;
    if (error) return <div id="content" className="error-state"><FaExclamationCircle /> {error}</div>;

    const now = new Date();
    const today = now.toLocaleDateString('hu-HU', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });

    const greetHour = now.getHours();
    const greeting = greetHour < 12 ? 'Jó reggelt' : greetHour < 18 ? 'Jó napot' : 'Jó estét';

    const gradingQueue = assignments
        .filter(a => a.completedCount > 0)
        .sort((a, b) => b.completedCount - a.completedCount)
        .slice(0, 5);

    const upcomingDeadlines = assignments
        .filter(a => a.dueDate && new Date(a.dueDate) > now)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 6);

    const dueSoonCount = assignments.filter(a => {
        const days = getDaysUntil(a.dueDate);
        return days !== null && days >= 0 && days <= 7;
    }).length;

    return (
        <div id="content">
            <div className="dashboard-container">

                <div className="dash-greeting">
                    <div className="dash-greeting-left">
                        <h1>{greeting}, {user?.name?.split(' ')[0] || 'Tanár'}!</h1>
                        <p className="dash-date">{today}</p>
                    </div>
                    <div className="dash-greeting-right">
                        {(user?.subjects || []).map(s => (
                            <span key={s} className="dash-subject-badge">{s}</span>
                        ))}
                        <span className="dash-class-badge"><FaUsers /> {classes.length} osztály</span>
                    </div>
                </div>

                <div className="dash-stats-row">
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon blue"><FaClipboard /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{stats?.totalAssignments ?? assignments.length}</div>
                            <div className="dash-stat-label">Létrehozott dolgozat</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon orange"><FaBrain /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{gradingQueue.length}</div>
                            <div className="dash-stat-label">Javítást vár</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon red"><FaClock /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">{dueSoonCount}</div>
                            <div className="dash-stat-label">Hamarosan lejár</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon green"><FaChartBar /></div>
                        <div className="dash-stat-body">
                            <div className="dash-stat-value">
                                {stats?.completionRate != null ? Math.round(stats.completionRate) + '%' : '—'}
                            </div>
                            <div className="dash-stat-label">Teljesítési arány</div>
                        </div>
                    </div>
                </div>

                <div className="dash-two-col">
                    <div className="dash-section-card">
                        <div className="dash-section-title">
                            <FaBrain /> Javítási sor
                            {gradingQueue.length > 0 && (
                                <span className="dash-count-badge">{gradingQueue.length}</span>
                            )}
                        </div>
                        {gradingQueue.length === 0 ? (
                            <div className="dash-empty">
                                <FaCheckCircle className="dash-empty-icon green" />
                                <p>Nincs javítandó beküldés</p>
                            </div>
                        ) : (
                            <div className="dash-item-list">
                                {gradingQueue.map(a => (
                                    <div key={a._id} className="dash-item-row">
                                        <div className="dash-item-info">
                                            <span className="dash-item-subject">{a.subject}</span>
                                            <span className="dash-item-title">{a.title}</span>
                                        </div>
                                        <div className="dash-item-right">
                                            <span className="dash-submission-count">
                                                {a.completedCount} beküldés
                                            </span>
                                            <button
                                                className="dash-action-btn"
                                                onClick={() => navigate(
                                                    `/generalt-dolgozatok/${a._id}`,
                                                    { state: { assignment: a } }
                                                )}
                                            >
                                                Javítás <FaArrowRight />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="dash-section-card">
                        <div className="dash-section-title">
                            <FaClock /> Közelgő határidők
                            {upcomingDeadlines.length > 0 && (
                                <span className="dash-count-badge">{upcomingDeadlines.length}</span>
                            )}
                        </div>
                        {upcomingDeadlines.length === 0 ? (
                            <div className="dash-empty">
                                <FaCalendarAlt className="dash-empty-icon" />
                                <p>Nincs közelgő határidő</p>
                            </div>
                        ) : (
                            <div className="dash-item-list">
                                {upcomingDeadlines.map(a => {
                                    const days = getDaysUntil(a.dueDate);
                                    const uc = urgencyClass(days);
                                    return (
                                        <div key={a._id} className="dash-item-row">
                                            <div className="dash-item-info">
                                                <span className="dash-item-subject">{a.subject}</span>
                                                <span className="dash-item-title">{a.title}</span>
                                            </div>
                                            <div className="dash-item-right">
                                                <span className={`dash-deadline-badge ${uc}`}>
                                                    {urgencyLabel(days)}
                                                </span>
                                                <button
                                                    className="dash-action-btn"
                                                    onClick={() => navigate(
                                                        `/generalt-dolgozatok/${a._id}`,
                                                        { state: { assignment: a } }
                                                    )}
                                                >
                                                    <FaArrowRight />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="dash-section-card dash-quick-actions-card">
                    <div className="dash-section-title">
                        <FaTachometerAlt /> Gyors műveletek
                    </div>
                    <div className="dash-quick-actions">
                        <button
                            className="dash-primary-action"
                            onClick={() => navigate('/dolgozat-generalas')}
                        >
                            <FaPlus /> Új dolgozat generálása
                        </button>
                        <button
                            className="dash-secondary-action"
                            onClick={() => navigate('/generalt-dolgozatok')}
                        >
                            <FaClipboard /> Összes dolgozat
                        </button>
                        <button
                            className="dash-secondary-action"
                            onClick={() => navigate('/statisztika')}
                        >
                            <FaChartBar /> Statisztika
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TeacherDashboard;
