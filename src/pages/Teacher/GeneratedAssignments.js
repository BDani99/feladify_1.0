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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await fetchAssignments();
                setAssignments(data);
                console.log(data);
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

    return (
        <div id="content">
            <div className="assignments-container">
                <h1 className="title">Dolgozat Kiértékelés</h1>
                <div className="assignment-grid">
                    {assignments.slice().reverse().map((assignment) => (
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
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GeneratedAssignments;
