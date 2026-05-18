import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTasks, FaCalendarAlt, FaStar, FaChevronRight, FaFolderOpen } from 'react-icons/fa';
import ParentChildSelector from '../../components/ParentChildSelector';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Parent/ParentTasks.css';
import '../../styles/Student/StudentDashboard.css';

const ParentTasks = () => {
    const navigate = useNavigate();
    const [children, setChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [subjectFilter, setSubjectFilter] = useState('all');

    useEffect(() => {
        const fetchChildren = async () => {
            try {
                const res = await fetch('/api/parent/children', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                const data = await res.json();
                if (data.children && data.children.length > 0) {
                    setChildren(data.children);
                    if (!selectedChildId || !data.children.some(c => c._id === selectedChildId)) {
                        setSelectedChildId(data.children[0]._id);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Hiba történt a gyermekek betöltésekor.');
            }
        };
        fetchChildren();
    }, [selectedChildId]);

    useEffect(() => {
        if (!selectedChildId) return;
        const fetchAssignments = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/parent/child/${selectedChildId}/assignments`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAssignments(data.assignments || []);
                } else {
                    setError('Nem sikerült betölteni a gyermek feladatait.');
                }
            } catch (err) {
                console.error(err);
                setError('Hiba a feladatok lekérésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, [selectedChildId]);

    const handleChildChange = (id) => {
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    const uniqueSubjects = ['all', ...new Set(assignments.map(a => a.subject))];

    const filteredAssignments = assignments.filter(a => {
        const matchesStatus = filter === 'all' || a.status === filter;
        const matchesSubject = subjectFilter === 'all' || a.subject === subjectFilter;
        return matchesStatus && matchesSubject;
    });

    const getStatusBadge = (status, grade) => {
        switch (status) {
            case 'completed':
                return <span className="parent-status-badge completed">Befejezve {grade ? `(${grade})` : ''}</span>;
            case 'started':
                return <span className="parent-status-badge started">Megkezdve (Piszkozat)</span>;
            default:
                return <span className="parent-status-badge not_started">Nincs megnyitva</span>;
        }
    };

    if (children.length === 0 && !loading) {
        return (
            <div id="content">
                <div className="dashboard-container">
                    <div className="dash-section-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                        <FaTasks style={{ fontSize: '3.5rem', color: 'var(--accent)', marginBottom: 24 }} />
                        <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Nincs még összekapcsolt gyermek</h2>
                        <p style={{ color: 'var(--color-text-dim)' }}>A feladatok megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
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
                    <h1 className="phb-title">Gyermek Teendők</h1>
                    <p className="phb-subtitle">Kísérd figyelemmel gyermeked aktív és megoldott feladatait.</p>
                </div>
                {children.length > 0 && (
                    <ParentChildSelector
                        childrenList={children}
                        selectedId={selectedChildId}
                        onChange={handleChildChange}
                    />
                )}
            </div>

            {/* Státusz szűrők */}
            <div className="parent-filter-bar">
                <button className={`parent-filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>Összes</button>
                <button className={`parent-filter-btn${filter === 'not_started' ? ' active-secondary' : ''}`} onClick={() => setFilter('not_started')}>Nincs megnyitva</button>
                <button className={`parent-filter-btn${filter === 'started' ? ' active-warning' : ''}`} onClick={() => setFilter('started')}>Folyamatban</button>
                <button className={`parent-filter-btn${filter === 'completed' ? ' active-success' : ''}`} onClick={() => setFilter('completed')}>Befejezett</button>
            </div>

            {/* Tantárgy szűrők */}
            {uniqueSubjects.length > 2 && (
                <div className="parent-subject-filter-bar">
                    {uniqueSubjects.map(subj => (
                        <button
                            key={subj}
                            className={`parent-subject-btn${subjectFilter === subj ? ' active' : ''}`}
                            onClick={() => setSubjectFilter(subj)}
                        >
                            {subj === 'all' ? 'Minden tantárgy' : subj}
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Betöltés...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="alert alert-danger" role="alert">{error}</div>
            ) : (
                <div className="parent-tasks-list">
                    {filteredAssignments.length === 0 ? (
                        <div className="glass-card parent-empty-list">
                            <FaFolderOpen className="parent-empty-list-icon" />
                            <p>Nincs a szűrésnek megfelelő feladat.</p>
                        </div>
                    ) : (
                        filteredAssignments.map(a => (
                            <div key={a._id} className="glass-card parent-task-card transition-card">
                                <div className="parent-task-left">
                                    <div className="parent-task-icon">
                                        <FaTasks />
                                    </div>
                                    <div className="parent-task-info">
                                        <div className="parent-task-badges">
                                            <span className="parent-subject-badge">{a.subject}</span>
                                            {getStatusBadge(a.status, a.grade)}
                                        </div>
                                        <h5 className="parent-task-title">{a.title}</h5>
                                        <div className="parent-task-meta">
                                            <span><FaCalendarAlt /> Határidő: {a.dueDate ? new Date(a.dueDate).toLocaleDateString('hu-HU') : 'Nincs'}</span>
                                            <span><FaStar /> Max: {a.totalPoints} pont</span>
                                        </div>
                                    </div>
                                </div>
                                {a.status === 'completed' && (
                                    <button
                                        className="main-button"
                                        style={{ width: 'auto', marginTop: 0, padding: '8px 20px', fontSize: '0.875rem' }}
                                        onClick={() => navigate(`/szulo-eredmenyek/${a._id}`)}
                                    >
                                        Eredmények <FaChevronRight />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
          </div>
        </div>
    );
};

export default ParentTasks;
