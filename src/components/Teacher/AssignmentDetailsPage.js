import React from 'react';
import { useLocation } from 'react-router-dom';
import '../../styles/Teacher/AssignmentDetails.css';

const AssignmentDetailsPage = () => {
    const location = useLocation();
    const { assignment } = location.state || {};

    if (!assignment) {
        return <div>Nem található dolgozat.</div>;
    }

    return (
        <div id="content">
            <div className="assignment-details-container">
                <div className="assignment-details-header">
                    <h1 className='title'>{assignment.title}</h1>
                    <div className="assignment-meta">
                        <span className="meta-badge">{assignment.subject}</span>
                        <span className="meta-badge">{assignment.difficulty}</span>
                        <span className="meta-badge">{assignment.questions?.length || 0} kérdés</span>
                    </div>
                </div>
                <div className="questions-container">
                    {assignment.questions?.map((question, index) => (
                        <div key={index} className="question-card">
                            <p className="question-text">
                                <strong>{index + 1}.</strong> {question.questionText}
                            </p>
                            {question.options && question.options.length > 0 ? (
                                <ul className="question-options">
                                    {question.options.map((opt, i) => (
                                        <li
                                            key={i}
                                            className={opt === question.correctAnswer ? 'option correct-option' : 'option'}
                                        >
                                            {opt}
                                            {opt === question.correctAnswer && (
                                                <span className="correct-badge"> ✓</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="correct-answer">
                                    <strong>Helyes válasz:</strong> {question.correctAnswer}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AssignmentDetailsPage;
