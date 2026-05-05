import React, { useState, useEffect } from 'react';
import { fetchAvaiableAssignments } from '../../api/Assignments/Student/Assignments';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/GeneratedAssignments.css'

const AvaiableAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAssignments = async () => {
            try {
                const data = await fetchAvaiableAssignments();
                if (Array.isArray(data.assignments)) {
                    setAssignments(data.assignments);
                    console.log(data);
                    console.log(data.assignment);
                } else {
                    setAssignments([]);
                }
                setMessage(data.message);
            } catch (err) {
                setError('Hiba történt a dolgozatok lekérésekor');
            } finally {
                setLoading(false);
            }
        };

        loadAssignments();
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
                <div className="assignment-grid">
                    {assignments.length > 0 ? (
                        assignments.slice().reverse().map((assignment) => (
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
                                        </div>
                                        <div>
                                            <p>{assignment.subject}</p>
                                            <p>{assignment.difficulty}</p>
                                            <p className="created">
                                                {format(new Date(assignment.createdAt), 'yyyy.MM.dd HH:mm:ss')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p>Nincsenek elérhető dolgozatok.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AvaiableAssignments;
