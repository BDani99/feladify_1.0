import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTasks, FaCalendarAlt, FaStar, FaChevronRight, FaBookmark, FaFolderOpen } from 'react-icons/fa';
import '../../styles/Student/StudentDashboard.css';

const ParentTasks = () => {
    const navigate = useNavigate();
    const [children, setChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'not_started', 'started', 'completed'
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

    const handleChildChange = (e) => {
        const id = e.target.value;
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
                return <span className="badge bg-success bg-opacity-10 text-success px-3 py-2" style={{ borderRadius: '12px', fontWeight: '600' }}>Befejezve {grade ? `(${grade})` : ''}</span>;
            case 'started':
                return <span className="badge bg-warning bg-opacity-10 text-warning px-3 py-2" style={{ borderRadius: '12px', fontWeight: '600' }}>Megkezdve (Piszkozat)</span>;
            default:
                return <span className="badge bg-secondary bg-opacity-10 text-secondary px-3 py-2" style={{ borderRadius: '12px', fontWeight: '600' }}>Nincs megnyitva</span>;
        }
    };

    if (children.length === 0 && !loading) {
        return (
            <div id='content' className="d-flex flex-column align-items-center justify-content-center text-center p-5" style={{ minHeight: '80vh' }}>
                <div className="glass-card p-5 text-center shadow-lg" style={{ maxWidth: '600px', borderRadius: '24px' }}>
                    <FaTasks className="text-primary mb-4" style={{ fontSize: '4rem' }} />
                    <h2 className="mb-3">Nincs még összekapcsolt gyermek</h2>
                    <p className="text-muted mb-4">A feladatok megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
                </div>
            </div>
        );
    }

    return (
        <div id="content" className="container py-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-5 gap-3">
                <div>
                    <h1 className="main-title text-start mb-1">Gyermek Teendők</h1>
                    <p className="text-muted">Kísérd figyelemmel gyermeked aktív és megoldott házi feladatait.</p>
                </div>

                <div className="d-flex align-items-center gap-2 glass-card px-3 py-2" style={{ borderRadius: '16px' }}>
                    <span className="text-muted me-2" style={{ fontSize: '0.9rem' }}>Gyermek:</span>
                    <select className="form-select border-0 bg-transparent text-primary" value={selectedChildId} onChange={handleChildChange} style={{ fontWeight: '600', cursor: 'pointer', outline: 'none' }}>
                        {children.map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Szűrők */}
            <div className="d-flex flex-wrap gap-2 mb-4 justify-content-start">
                <button className={`btn rounded-pill px-4 ${filter === 'all' ? 'btn-primary' : 'btn-outline-secondary bg-transparent'}`} onClick={() => setFilter('all')}>Összes</button>
                <button className={`btn rounded-pill px-4 ${filter === 'not_started' ? 'btn-secondary text-white' : 'btn-outline-secondary bg-transparent'}`} onClick={() => setFilter('not_started')}>Nincs megnyitva</button>
                <button className={`btn rounded-pill px-4 ${filter === 'started' ? 'btn-warning text-dark' : 'btn-outline-secondary bg-transparent'}`} onClick={() => setFilter('started')}>Folyamatban</button>
                <button className={`btn rounded-pill px-4 ${filter === 'completed' ? 'btn-success text-white' : 'btn-outline-secondary bg-transparent'}`} onClick={() => setFilter('completed')}>Befejezett</button>
            </div>

            {/* Tantárgy Szűrők */}
            {uniqueSubjects.length > 2 && (
                <div className="d-flex flex-wrap gap-2 mb-5 justify-content-start">
                    {uniqueSubjects.map(subj => (
                        <button 
                            key={subj} 
                            className={`btn btn-sm rounded-pill px-3 ${subjectFilter === subj ? 'btn-info text-white' : 'btn-outline-info bg-transparent'}`} 
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
                <div className="alert alert-danger glass-card" role="alert">{error}</div>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {filteredAssignments.length === 0 ? (
                        <div className="glass-card text-center p-5 text-muted" style={{ borderRadius: '24px' }}>
                            <FaFolderOpen className="mb-3" style={{ fontSize: '3rem' }} />
                            <p className="mb-0">Nincs a szűrésnek megfelelő feladat.</p>
                        </div>
                    ) : (
                        filteredAssignments.map(a => (
                            <div 
                                key={a._id} 
                                className="glass-card p-4 d-flex flex-wrap justify-content-between align-items-center gap-3 transition-card"
                                style={{ borderRadius: '20px', textAlign: 'left' }}
                            >
                                <div className="d-flex align-items-center gap-4">
                                    <div className="p-3 bg-primary bg-opacity-10 text-primary d-none d-sm-block" style={{ borderRadius: '15px' }}>
                                        <FaTasks style={{ fontSize: '1.5rem' }} />
                                    </div>
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                            <span className="badge bg-primary bg-opacity-10 text-primary px-2.5 py-1" style={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>{a.subject}</span>
                                            {getStatusBadge(a.status, a.grade)}
                                        </div>
                                        <h5 className="mb-1" style={{ fontWeight: '700' }}>{a.title}</h5>
                                        <div className="d-flex gap-3 text-muted" style={{ fontSize: '0.85rem' }}>
                                            <span className="d-flex align-items-center gap-1"><FaCalendarAlt /> Határidő: {a.dueDate ? new Date(a.dueDate).toLocaleDateString('hu-HU') : 'Nincs'}</span>
                                            <span className="d-flex align-items-center gap-1"><FaStar /> Max pont: {a.totalPoints} pont</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {a.status === 'completed' && (
                                    <button 
                                        className="main-button py-2 px-4 d-flex align-items-center gap-2" 
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
    );
};

export default ParentTasks;
