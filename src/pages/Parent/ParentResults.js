import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
    FaAward, FaBook,
    FaCalendarAlt, FaChevronDown, FaExclamationCircle, FaArrowRight
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import ParentChildSelector from '../../components/ParentChildSelector';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Student/CompletedAssignments.css';

const ParentResults = () => {
    const [children, setChildren] = useState([]);
    const [childrenLoaded, setChildrenLoaded] = useState(false);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [collapsedSubjects, setCollapsedSubjects] = useState({});

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
                        const firstId = data.children[0]._id;
                        setSelectedChildId(firstId);
                        localStorage.setItem('parent-selected-child', firstId);
                    }
                } else {
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                setLoading(false);
            } finally {
                setChildrenLoaded(true);
            }
        };
        fetchChildren();
    }, []);

    useEffect(() => {
        if (!selectedChildId) return;
        const fetchResults = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/parent/child/${selectedChildId}/results`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.results || []);
                } else {
                    setError('Nem sikerült betölteni a gyermek eredményeit.');
                }
            } catch (err) {
                console.error(err);
                setError('Hiba az eredmények lekérésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchResults();
    }, [selectedChildId]);

    const handleChildChange = (id) => {
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    const toggleSubject = (subject) => {
        setCollapsedSubjects(prev => ({ ...prev, [subject]: !prev[subject] }));
    };

    const gradedResults = results.filter(r => r.grade !== null && r.grade !== undefined);
    const pendingCount = results.filter(r => r.grade === null || r.grade === undefined).length;

    const groupBySubject = (list) => {
        return list.slice().reverse().reduce((acc, r) => {
            const sub = r.subject || 'Egyéb';
            if (!acc[sub]) acc[sub] = [];
            acc[sub].push(r);
            return acc;
        }, {});
    };

    const grouped = groupBySubject(gradedResults);

    if (childrenLoaded && children.length === 0) {
        return (
            <div id="content">
                <div className="completed-assignments-wrapper">
                    <div className="empty-state-completed" style={{ padding: '60px 40px' }}>
                        <FaAward style={{ fontSize: '3.5rem', color: '#10b981', marginBottom: 24, opacity: 1 }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>Nincs még összekapcsolt gyermek</p>
                        <p style={{ fontSize: '0.9rem' }}>Az elért osztályzatok megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="content">
            <div className="completed-assignments-wrapper">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaAward /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Eredmények és Osztályzatok</h1>
                        <p className="phb-subtitle">Tekintsd meg gyermeked javított dolgozatainak részletes értékeléseit.</p>
                    </div>
                    {children.length > 0 && (
                        <ParentChildSelector
                            childrenList={children}
                            selectedId={selectedChildId}
                            onChange={handleChildChange}
                        />
                    )}
                </div>

                {(!childrenLoaded || loading) ? (
                    <div style={{ minHeight: 300 }}><LoadingSpinner /></div>
                ) : error ? (
                    <div className="error-box"><FaExclamationCircle /> {error}</div>
                ) : (
                    <>
                        <div className="stats-mini-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                            <div className="mini-stat">
                                <div className="stat-label">Átlag osztályzat</div>
                                <div className="stat-val">
                                    {gradedResults.length > 0
                                        ? (gradedResults.reduce((s, r) => s + Number(r.grade), 0) / gradedResults.length).toFixed(1)
                                        : '—'}
                                </div>
                            </div>
                            <div className="mini-stat">
                                <div className="stat-label">Értékelt dolgozat</div>
                                <div className="stat-val">{gradedResults.length}</div>
                            </div>
                        </div>

                        {pendingCount > 0 && (
                            <div style={{
                                padding: '10px 18px',
                                background: 'rgba(245, 158, 11, 0.08)',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                borderRadius: 'var(--radius-md)',
                                color: '#f59e0b',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                marginBottom: 24
                            }}>
                                ⏳ {pendingCount} dolgozat még javítás alatt — az értékelés után automatikusan megjelenik.
                            </div>
                        )}

                        <div className="completed-groups-container">
                            {gradedResults.length === 0 ? (
                                <div className="empty-state-completed">
                                    <FaAward />
                                    <p>Gyermekednek még nincs értékelt dolgozata.</p>
                                </div>
                            ) : (
                                Object.keys(grouped).map((subject) => {
                                    const subjectList = grouped[subject];
                                    const isCollapsed = !!collapsedSubjects[subject];
                                    return (
                                        <div key={subject} className="subject-section">
                                            <div
                                                className={`subject-section-header${isCollapsed ? ' collapsed' : ''}`}
                                                onClick={() => toggleSubject(subject)}
                                            >
                                                <FaBook />
                                                <h2 className="subject-section-title">{subject}</h2>
                                                <div className="subject-header-right">
                                                    <span className="subject-count-badge">
                                                        {subjectList.length} értékelt
                                                    </span>
                                                    <span className="chevron-icon"><FaChevronDown /></span>
                                                </div>
                                            </div>

                                            {!isCollapsed && (
                                                <div className="completed-grid">
                                                    {subjectList.map((r) => (
                                                        <Link
                                                            key={r.assignmentId}
                                                            to={`/szulo-eredmenyek/${r.assignmentId}`}
                                                            state={{ assignment: r }}
                                                            className="completed-card-link"
                                                        >
                                                            <div className="completed-card">
                                                                <div className="card-side-accent"></div>
                                                                <div className="card-main">
                                                                    <div className="card-header-row">
                                                                        <div className="subject-tag">{r.subject}</div>
                                                                        <div className="date-tag">
                                                                            <FaCalendarAlt />
                                                                            {r.completedAt ? format(new Date(r.completedAt), 'yyyy.MM.dd') : '—'}
                                                                        </div>
                                                                    </div>
                                                                    <h3 className="card-title">{r.title}</h3>
                                                                    <div className="card-details-row">
                                                                        {r.grade ? (
                                                                            <>
                                                                                <div className="points-box">
                                                                                    <span className="label">Pontszám</span>
                                                                                    <span className="val">{r.achievedPoints} / {r.totalPoints}</span>
                                                                                </div>
                                                                                <div className="grade-box">
                                                                                    <span className="label">Osztályzat</span>
                                                                                    <span className={`val grade-${r.grade}`}>{r.grade}</span>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <span className="pending-score-msg">Az eredmény a tanári értékelés után lesz látható.</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="card-arrow"><FaArrowRight /></div>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ParentResults;
