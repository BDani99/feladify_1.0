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
                <h1 className='title'>{assignment.title}</h1>
                <div className="questions-container">
                    {assignment.questions?.map((question, index) => (
                        <div key={index} className="question-card">
                            <p><strong>{index + 1}. Kérdés:</strong> {question.questionText}</p>
                            <p><strong>Helyes válasz:</strong> {question.correctAnswer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AssignmentDetailsPage;
