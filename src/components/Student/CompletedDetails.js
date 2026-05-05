import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FaCheck, FaTimes, FaClock } from 'react-icons/fa';
import { flagAnswer } from '../../api/Student/FlagAnswer';
import TutorChat from './TutorChat';
import '../../styles/Student/CompletedDetails.css';
import '../../styles/Student/TutorChat.css';

const CompletedDetails = () => {
    const location = useLocation();
    const { assignment } = location.state;
    const [openTutors, setOpenTutors] = useState({});
    const [flaggedAnswers, setFlaggedAnswers] = useState({});

    const toggleTutor = (questionId) =>
        setOpenTutors(prev => ({ ...prev, [questionId]: !prev[questionId] }));

    const handleFlag = async (questionId) => {
        try {
            await flagAnswer(assignment.assignmentId, questionId);
            setFlaggedAnswers(prev => ({ ...prev, [questionId]: true }));
        } catch {
            // silent
        }
    };

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
                            {assignment.answers.map((answer, index) => {
                                const isOpenEnded = !answer.correctAnswer?.startsWith('A:') && !answer.correctAnswer?.startsWith('B:');
                                const isPending = answer.score === 0 && isOpenEnded;
                                const isWrong = answer.score === 0 && !isOpenEnded;
                                const isFlagged = flaggedAnswers[answer.questionId] || answer.flagged;
                                const showTutor = openTutors[answer.questionId];

                                return (
                                    <div key={answer.questionId} className="answer-item">
                                        <div className='answer-icon-container'>
                                            {isPending ? (
                                                <span className="answer-pending-badge">
                                                    <FaClock style={{ fontSize: '14px' }} />
                                                    Javítás alatt
                                                </span>
                                            ) : isWrong ? (
                                                <FaTimes style={{ color: 'red', fontSize: '25px' }} />
                                            ) : (
                                                <FaCheck style={{ color: 'green', fontSize: '25px' }} />
                                            )}
                                        </div>
                                        <p><strong>{index + 1}. kérdés:</strong> {answer.questionText}</p>
                                        <p>
                                            <strong>Helyes válasz:</strong>{' '}
                                            {isPending
                                                ? <span style={{ color: 'var(--color-text-dim)' }}>—</span>
                                                : answer.correctAnswer
                                            }
                                        </p>
                                        <p><strong>A te válaszod:</strong> {answer.studentAnswer}</p>
                                        <p><strong>Elért pont:</strong> {answer.score} pont</p>

                                        {isPending && (
                                            <div style={{ marginTop: 8 }}>
                                                <button
                                                    className="tutor-toggle-btn"
                                                    onClick={() => toggleTutor(answer.questionId)}
                                                >
                                                    {showTutor ? 'Bezárás' : 'Kérek segítséget'}
                                                </button>
                                                <button
                                                    className="flag-btn"
                                                    onClick={() => handleFlag(answer.questionId)}
                                                    disabled={isFlagged}
                                                    style={{ marginLeft: 8 }}
                                                >
                                                    {isFlagged ? 'Jelzés elküldve' : 'Nem értem a javítást'}
                                                </button>
                                                {showTutor && (
                                                    <TutorChat
                                                        questionText={answer.questionText}
                                                        correctAnswer={answer.correctAnswer}
                                                        studentAnswer={answer.studentAnswer}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompletedDetails;
