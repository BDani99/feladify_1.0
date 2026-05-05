import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fetchCompletedAssignments } from '../../api/Assignments/Student/Assignments';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/GeneratedAssignments.css'

const CompletedAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const getAssignments = async () => {
            try {
                const data = await fetchCompletedAssignments();
                setAssignments(data);
                console.log(data)
            } catch (error) {
                setError('Failed to load assignments');
            } finally {
                setLoading(false);
            }
        };

        getAssignments();
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
        <div id='content'>
            <div className="assignments-container">
                <h1 className="title">Megoldott Dolgozatok</h1>
                <div className="assignment-grid">

                    {assignments.length === 0 ? (
                        <div>No completed assignments found.</div>
                    ) : (
                        assignments.slice().reverse().map((assignment) => (
                            <div key={assignment.assignmentId}>
                                <Link
                                    key={assignment._id}
                                    to={`/megoldott-dolgozatok/${assignment.assignmentId}`}
                                    className="assignment-card-link"
                                    state={{ assignment }}
                                >
                                    <div className="assignment-card">
                                        <div className="title-container">
                                            <h3>{assignment.title}</h3>
                                        </div>
                                        <div className="assignment-card-text">
                                            <div>
                                                <p>Tantárgy:</p>
                                                <p>Elérhető/Elért pont:</p>
                                                <p>Megoldás dátuma:</p>
                                            </div>
                                            <div>
                                                <p>{assignment.subject}</p>
                                                <p>{assignment.totalPoints}/{assignment.achievedPoints} pont</p>
                                                <p className="created">
                                                    {format(new Date(assignment.completedAt), 'yyyy.MM.dd HH:mm:ss')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>

                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompletedAssignments;
