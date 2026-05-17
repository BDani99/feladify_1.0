import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fetchCompletedAssignments } from '../../api/Assignments/Student/Assignments';
import { 
    FaCheckCircle, 
    FaHourglassHalf, 
    FaGraduationCap, 
    FaBook, 
    FaCalendarAlt, 
    FaTrophy,
    FaExclamationCircle,
    FaArrowRight,
    FaChevronDown
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Student/CompletedAssignments.css';

const CompletedAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('graded');
    const [collapsedSubjects, setCollapsedSubjects] = useState({});

    useEffect(() => {
        const getAssignments = async () => {
            try {
                const data = await fetchCompletedAssignments();
                setAssignments(Array.isArray(data) ? data : (data.assignments || []));
            } catch (error) {
                setError('A megoldott dolgozatok betöltése nem sikerült.');
            } finally {
                setLoading(false);
            }
        };
        getAssignments();
    }, []);

    const toggleSubject = (subject) => {
        setCollapsedSubjects(prev => ({
            ...prev,
            [subject]: !prev[subject]
        }));
    };

    const gradedAssignments = assignments.filter(a => a.grade !== null && a.grade !== undefined);
    const pendingAssignments = assignments.filter(a => a.grade === null || a.grade === undefined);

    const displayList = activeTab === 'graded' ? gradedAssignments : pendingAssignments;

    const groupAssignmentsBySubject = (list) => {
        const orderedList = list.slice().reverse();
        return orderedList.reduce((acc, a) => {
            const sub = a.subject || 'Egyéb';
            if (!acc[sub]) acc[sub] = [];
            acc[sub].push(a);
            return acc;
        }, {});
    };

    const grouped = groupAssignmentsBySubject(displayList);

    return (
        <div id='content'>
            <div className="completed-assignments-wrapper">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaCheckCircle /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Befejezett Dolgozatok</h1>
                        <p className="phb-subtitle">Tekintsd meg az eredményeidet és a tanári visszajelzéseket</p>
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : error ? (
                    <div className="error-box"><FaExclamationCircle /> {error}</div>
                ) : (
                <>
                <div className="stats-mini-grid">
                    <div className="mini-stat">
                        <div className="stat-label">Átlag osztályzat</div>
                        <div className="stat-val">
                            {gradedAssignments.length > 0 
                                ? (gradedAssignments.reduce((s, a) => s + a.grade, 0) / gradedAssignments.length).toFixed(1) 
                                : '—'}
                        </div>
                    </div>
                    <div className="mini-stat">
                        <div className="stat-label">Befejezett</div>
                        <div className="stat-val">{assignments.length}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="stat-label">Javítás alatt</div>
                        <div className="stat-val">{pendingAssignments.length}</div>
                    </div>
                </div>

                <div className="status-tabs-premium">
                    <button 
                        className={activeTab === 'graded' ? 'active' : ''} 
                        onClick={() => setActiveTab('graded')}
                    >
                        Értékelt ({gradedAssignments.length})
                    </button>
                    <button 
                        className={activeTab === 'pending' ? 'active' : ''} 
                        onClick={() => setActiveTab('pending')}
                    >
                        Javítás alatt ({pendingAssignments.length})
                    </button>
                </div>

                <div className="completed-groups-container">
                    {displayList.length === 0 ? (
                        <div className="empty-state-completed">
                            <FaHourglassHalf />
                            <p>Nincsenek dolgozatok ebben a kategóriában.</p>
                        </div>
                    ) : (
                        Object.keys(grouped).map((subject) => {
                            const subjectList = grouped[subject];
                            const isCollapsed = !!collapsedSubjects[subject];
                            return (
                                <div key={subject} className="subject-section">
                                    <div 
                                        className={`subject-section-header ${isCollapsed ? 'collapsed' : ''}`}
                                        onClick={() => toggleSubject(subject)}
                                    >
                                        <FaBook />
                                        <h2 className="subject-section-title">{subject}</h2>
                                        <div className="subject-header-right">
                                            <span className="subject-count-badge">
                                                {subjectList.length} {activeTab === 'graded' ? 'értékelt' : 'javítás alatt'}
                                            </span>
                                            <span className="chevron-icon">
                                                <FaChevronDown />
                                            </span>
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="completed-grid">
                                            {subjectList.map((a) => (
                                                <Link 
                                                    key={a.assignmentId} 
                                                    to={`/megoldott-dolgozatok/${a.assignmentId}`} 
                                                    className="completed-card-link"
                                                    state={{ assignment: a }}
                                                >
                                                    <div className="completed-card">
                                                        <div className="card-side-accent"></div>
                                                        <div className="card-main">
                                                            <div className="card-header-row">
                                                                <div className="subject-tag">{a.subject}</div>
                                                                <div className="date-tag">
                                                                    <FaCalendarAlt /> {format(new Date(a.completedAt), 'yyyy.MM.dd')}
                                                                </div>
                                                                <div className={`status-badge ${a.grade ? 'graded' : 'pending'}`}>
                                                                    {a.grade ? 'ÉRTÉKELVE' : 'JAVÍTÁS ALATT'}
                                                                </div>
                                                            </div>
                                                            
                                                            <h3 className="card-title">{a.title}</h3>
                                                            
                                                            <div className="card-details-row">
                                                                {a.grade ? (
                                                                    <>
                                                                        <div className="points-box">
                                                                            <span className="label">Pontszám</span>
                                                                            <span className="val">{a.achievedPoints} / {a.totalPoints}</span>
                                                                        </div>
                                                                        <div className="grade-box">
                                                                            <span className="label">Osztályzat</span>
                                                                            <span className={`val grade-${a.grade}`}>{a.grade}</span>
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

export default CompletedAssignments;
