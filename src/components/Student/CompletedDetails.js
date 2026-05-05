import React from 'react';
import { useLocation } from 'react-router-dom';
import { FaCheck, FaTimes } from 'react-icons/fa';
import '../../styles/Student/CompletedDetails.css';

const CompletedDetails = () => {
    const location = useLocation();
    const { assignment } = location.state;

    return (
        <div id='content'>
            <div className="completed-details">
                <h1 className="title">{assignment.title}</h1>
                <div className='completed-details-container'>
                    <div className='assignment-data-container'>
                        <p><strong>Tantárgy:</strong> {assignment.subject}</p>
                        <p><strong>Megoldás dátuma:</strong> {new Date(assignment.completedAt).toLocaleString()}</p>
                        <p><strong>Összesen elérhető pont:</strong> {assignment.totalPoints}</p>
                        <p><strong>Összesen elért pont:</strong> {assignment.achievedPoints}</p>
                    </div>
                    <div className='answers-container'>
                        <div className="answers-list">
                            {assignment.answers.map((answer, index) => (
                                <div key={answer.questionId} className="answer-item">
                                    <div className='answer-icon-container'>
                                        {answer.score === 0 ? (
                                            <FaTimes style={{ color: 'red', fontSize: '25px' }} />
                                        ) : (
                                            <FaCheck style={{ color: 'green', fontSize: '25px' }} />
                                        )}
                                    </div>
                                    <p><strong>{index + 1}. kérdés:</strong> {answer.questionText}</p>
                                    <p><strong>Helyes válasz:</strong> {answer.correctAnswer}</p>
                                    <p><strong>A te válaszod:</strong> {answer.studentAnswer}</p>
                                    <p><strong>Elért pont:</strong> {answer.score} pont</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompletedDetails;
