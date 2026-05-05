import React, { useEffect, useState } from 'react';
import { fetchAssignments } from '../../api/Assignments/Teacher/Assignments';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/GeneratedAssignments.css';

const GeneratedAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await fetchAssignments();
                setAssignments(data);
            } catch (error) {
                setError('Hiba történt a dolgozatok betöltésekor');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div id="content">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return <div>{error}</div>;
    }

    const pendingAssignments = assignments.filter(a => {
        const total = a.studentIds?.length || 1;
        return (a.completedCount || 0) / total < 0.5;
    });

    const reviewAssignments = assignments.filter(a => (a.completedCount || 0) > 0);

    const displayList = activeTab === 'pending' ? pendingAssignments : reviewAssignments;

    return (
        <div id="content">
            <div className="assignments-container">
                <h1 className="title">Dolgozat Kiértékelés</h1>

                <ul className="completed-tabs">
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
                            onClick={() => setActiveTab('pending')}
                        >
                            Függőben ({pendingAssignments.length})
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'review' ? 'active' : ''}`}
                            onClick={() => setActiveTab('review')}
                        >
                            Javításra váró ({reviewAssignments.length})
                        </button>
                    </li>
                </ul>

                <div className="assignment-grid">
                    {displayList.length === 0 ? (
                        <p>Nincsenek dolgozatok ebben a kategóriában.</p>
                    ) : (
                        displayList.slice().reverse().map((assignment) => {
                            const total = assignment.studentIds?.length || 0;
                            const completed = assignment.completedCount || 0;
                            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                            return (
                                <Link
                                    key={assignment._id}
                                    to={`/generalt-dolgozatok/${assignment._id}`}
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
                                                <p>Kitöltöttség:</p>
                                            </div>
                                            <div>
                                                <p>{assignment.subject}</p>
                                                <p>{assignment.difficulty}</p>
                                                <p className="created">
                                                    {format(new Date(assignment.createdAt), 'yyyy.MM.dd HH:mm')}
                                                </p>
                                                <p>{completed} / {total} ({pct}%)</p>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeneratedAssignments;
