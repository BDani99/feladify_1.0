import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fetchCompletedAssignments } from '../../api/Assignments/Student/Assignments';
import { FaExclamationCircle } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/GeneratedAssignments.css'

function isOpenEnded(answers) {
    return answers.some(ans => {
        const ca = ans.correctAnswer || '';
        return !ca.startsWith('A:') && !ca.startsWith('B:') && ca.length > 0;
    });
}

const CompletedAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');

    useEffect(() => {
        const getAssignments = async () => {
            try {
                const data = await fetchCompletedAssignments();
                setAssignments(Array.isArray(data) ? data : (data.assignments || []));
            } catch (error) {
                setError('A megoldott dolgozatok betöltése nem sikerült. Kérjük, próbáld újra.');
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
        return <div id="content"><p className="error-message"><FaExclamationCircle />{error}</p></div>;
    }

    // Függőben: ahol minden pontszám 0, VAGY nyílt végű kérdések vannak
    const pendingAssignments = assignments.filter(a =>
        a.answers.every(ans => ans.score === 0) || isOpenEnded(a.answers)
    );

    // Javított: ahol legalább egy nem-nulla pontszám van
    const gradedAssignments = assignments.filter(a =>
        a.answers.some(ans => ans.score > 0)
    );

    const displayList = activeTab === 'pending' ? pendingAssignments : gradedAssignments;

    const renderCard = (assignment) => (
        <div key={assignment.assignmentId}>
            <Link
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
    );

    return (
        <div id='content'>
            <div className="assignments-container">
                <h1 className="title">Megoldott Dolgozatok</h1>

                <ul className="completed-tabs">
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
                            onClick={() => setActiveTab('pending')}
                        >
                            Függőben / Javítás alatt
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'graded' ? 'active' : ''}`}
                            onClick={() => setActiveTab('graded')}
                        >
                            Javított / Értékelt
                        </button>
                    </li>
                </ul>

                <div className="assignment-grid">
                    {displayList.length === 0 ? (
                        <p>Nincsenek dolgozatok ebben a kategóriában.</p>
                    ) : (
                        displayList.slice().reverse().map(renderCard)
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompletedAssignments;
