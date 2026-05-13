import React, { useState, useEffect } from 'react';
import { fetchAvailableAssignments } from '../../api/Assignments/Student/Assignments';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FaExclamationCircle, FaClock } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/GeneratedAssignments.css'

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
        let isMounted = true;
        const loadAssignments = async () => {
            try {
                const data = await fetchAvailableAssignments();
                if (isMounted) setAssignments(Array.isArray(data) ? [...data].reverse() : []);
            } catch (err) {
                if (isMounted) setError('Nem sikerült betölteni a dolgozatokat. Kérjük, próbáld újra.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadAssignments();
        return () => { isMounted = false; };
    }, []);

    if (loading) {
        return (
            <div id="content">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div id="content">
            <div className="assignments-container">
                <h1 className="title">Elérhető Dolgozatok</h1>
                {error && <p className="error-message"><FaExclamationCircle />{error}</p>}
                <div className="assignment-grid">
                    {assignments.length > 0 ? (
                        assignments.map((assignment) => {
                            const dl = getDeadlineInfo(assignment.dueDate);
                            const estimatedMinutes = (assignment.questions || []).length * 2;
                            return (
                                <Link
                                    key={assignment._id}
                                    to={`/dolgozat/${assignment._id}`}
                                    state={{ assignment }}
                                    className="assignment-card-link"
                                >
                                    <div className="assignment-card">
                                        <div className="title-container">
                                            <h3>{assignment.title}</h3>
                                        </div>
                                        <div className="assignment-card-text">
                                            <div>
                                                <p>Tantárgy:</p>
                                                <p>Nehézség:</p>
                                                <p>Létrehozva:</p>
                                                {dl && <p><FaClock style={{ fontSize: '0.75em', marginRight: 4 }} />Határidő:</p>}
                                                <p>Becsült idő:</p>
                                            </div>
                                            <div>
                                                <p>{assignment.subject}</p>
                                                <p>{assignment.difficulty}</p>
                                                <p className="created">
                                                    {format(new Date(assignment.createdAt), 'yyyy.MM.dd HH:mm:ss')}
                                                </p>
                                                {dl && (
                                                    <p className={dl.isUrgent || dl.isPast ? 'deadline-urgent' : ''}>
                                                        {dl.formatted}
                                                    </p>
                                                )}
                                                <p>{estimatedMinutes} perc</p>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <p>Nincsenek elérhető dolgozatok.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AvailableAssignments;
