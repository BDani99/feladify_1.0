import React, { useState, useEffect } from 'react';
import { fetchAvailableAssignments } from '../../api/Assignments/Student/Assignments';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
    FaExclamationCircle, 
    FaClock, 
    FaBook, 
    FaBrain, 
    FaHistory, 
    FaArrowRight, 
    FaClipboardList 
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Student/AvailableAssignments.css';

function getDeadlineInfo(dueDate) {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due - now;
    const isUrgent = diffMs > 0 && diffMs < 24 * 60 * 60 * 1000;
    const isPast = diffMs <= 0;
    return { due, isUrgent, isPast, formatted: format(due, 'yyyy.MM.dd HH:mm') };
}

const AvailableAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAssignments = async () => {
            try {
                const data = await fetchAvailableAssignments();
                setAssignments(Array.isArray(data) ? [...data].reverse() : []);
            } catch (err) {
                setError('Nem sikerült betölteni a dolgozatokat.');
            } finally {
                setLoading(false);
            }
        };
        loadAssignments();
    }, []);

    if (loading) return <div id="content"><LoadingSpinner /></div>;

    return (
        <div id="content">
            <div className="available-assignments-wrapper">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaClipboardList /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Elérhető Dolgozatok</h1>
                        <p className="phb-subtitle">Itt találod a tanáraid által kiosztott aktuális feladatsorokat</p>
                    </div>
                </div>

                {error && <div className="error-box"><FaExclamationCircle /> {error}</div>}

                <div className="student-assignment-grid">
                    {assignments.length > 0 ? (
                        assignments.map((a) => {
                            const dl = getDeadlineInfo(a.dueDate);
                            const estimatedMinutes = (a.questions || []).length * 2;
                            return (
                                <div key={a._id} className="student-assignment-card">
                                    <div className="card-top">
                                        <div className="subject-badge">{a.subject}</div>
                                        <div className={`difficulty-badge ${a.difficulty}`}>{a.difficulty}</div>
                                    </div>
                                    
                                    <h3 className="card-title">{a.title}</h3>
                                    
                                    <div className="card-meta">
                                        <div className="meta-item">
                                            <FaHistory /> <span>{format(new Date(a.createdAt), 'yyyy.MM.dd')}</span>
                                        </div>
                                        <div className="meta-item">
                                            <FaClock /> <span>{estimatedMinutes} perc</span>
                                        </div>
                                        {dl && (
                                            <div className={`meta-item deadline ${dl.isUrgent ? 'urgent' : ''} ${dl.isPast ? 'past' : ''}`}>
                                                <FaExclamationCircle /> <span>{dl.formatted}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="card-footer">
                                        <Link 
                                            to={`/dolgozat/${a._id}`} 
                                            state={{ assignment: a }} 
                                            className="start-btn"
                                        >
                                            Megoldás elkezdése <FaArrowRight />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state-student">
                            <FaBook />
                            <p>Jelenleg nincs kitöltendő dolgozatod.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AvailableAssignments;
