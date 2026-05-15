import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    FaCheckCircle, 
    FaTimesCircle, 
    FaClock, 
    FaBrain, 
    FaQuestionCircle, 
    FaTrophy, 
    FaInfoCircle,
    FaArrowLeft,
    FaExclamationTriangle
} from 'react-icons/fa';
import { flagAnswer } from '../../api/Student/FlagAnswer';
import TutorChat from './TutorChat';
import '../../styles/Student/CompletedDetails.css';

const CompletedDetails = () => {
    const location = useLocation();
    const { assignment } = location.state || {};
    const [openTutors, setOpenTutors] = useState({});
    const [flaggedAnswers, setFlaggedAnswers] = useState({});

    if (!assignment) return <div className="error-state">Adatok nem találhatók.</div>;

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

    const renderAnswer = (ans, type) => {
        if (ans === null || ans === undefined || ans === '') return '—';
        
        // Handle objects (matching)
        if (typeof ans === 'object' && !Array.isArray(ans)) {
            return (
                <div className="complex-ans-list">
                    {Object.entries(ans).map(([key, val], idx) => (
                        <div key={idx} className="complex-ans-item">
                            <span className="ans-key">{key}</span>
                            <span className="ans-arrow">→</span>
                            <span className="ans-val">{val}</span>
                        </div>
                    ))}
                </div>
            );
        }
        
        // Handle arrays (ordering)
        if (Array.isArray(ans)) {
            return (
                <div className="complex-ans-sequence">
                    {ans.map((item, idx) => (
                        <React.Fragment key={idx}>
                            <span className="sequence-item">{item}</span>
                            {idx < ans.length - 1 && <span className="sequence-arrow">→</span>}
                        </React.Fragment>
                    ))}
                </div>
            );
        }
        
        return <span className="simple-ans">{String(ans)}</span>;
    };

    return (
        <div id='content'>
            <div className="completed-details-premium">
                <header className="details-header">
                    <div className="header-top">
                        <h1 className="title">{assignment.title}</h1>
                        {assignment.grade && (
                            <div className={`final-grade grade-${assignment.grade}`}>
                                {assignment.grade}
                            </div>
                        )}
                    </div>
                    <div className="meta-info">
                        <div className="meta-box">
                            <FaTrophy />
                            <span>{assignment.achievedPoints} / {assignment.totalPoints} pont</span>
                        </div>
                        <div className="meta-box">
                            <FaClock />
                            <span>{new Date(assignment.completedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </header>

                <div className="answers-review">
                    <h2 className="section-title">Részletes kiértékelés</h2>
                    <div className="answers-list">
                        {assignment.answers.map((answer, index) => {
                            const isCorrect = answer.score === answer.maxPoints;
                            const isFlagged = flaggedAnswers[answer.questionId] || answer.flagged;
                            const showTutor = openTutors[answer.questionId];

                            return (
                                <div key={answer.questionId} className={`review-card ${isCorrect ? 'correct' : 'wrong'}`}>
                                    <div className="card-top">
                                        <div className="q-info">
                                            <span className="q-num">{index + 1}</span>
                                            <span className="q-type">{answer.questionType}</span>
                                        </div>
                                        <div className="score-badge">
                                            {answer.score} / {answer.maxPoints} pont
                                        </div>
                                    </div>

                                    <h3 className="q-text">{answer.questionText}</h3>

                                    <div className="comparison-grid">
                                        <div className="ans-block student">
                                            <label>Te válaszod</label>
                                            <div className="val">{renderAnswer(answer.studentAnswer, answer.questionType)}</div>
                                        </div>
                                        <div className="ans-block correct">
                                            <label>Helyes megoldás</label>
                                            <div className="val">{renderAnswer(answer.correctAnswer, answer.questionType)}</div>
                                        </div>
                                    </div>

                                    {answer.aiFeedback && (
                                        <div className="ai-feedback-box">
                                            <FaBrain className="brain-icon" />
                                            <div>
                                                <label>AI Magyarázat</label>
                                                <p>{answer.aiFeedback}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="card-actions">
                                        <button className="tutor-btn" onClick={() => toggleTutor(answer.questionId)}>
                                            {showTutor ? 'Chat bezárása' : 'AI Segítség kérése'}
                                        </button>
                                        <button 
                                            className={`flag-btn ${isFlagged ? 'active' : ''}`} 
                                            onClick={() => handleFlag(answer.questionId)}
                                            disabled={isFlagged}
                                        >
                                            {isFlagged ? 'Jelezve a tanárnak' : 'Nem értem a javítást'}
                                        </button>
                                    </div>

                                    {showTutor && (
                                        <div className="embedded-tutor">
                                            <TutorChat
                                                questionText={answer.questionText}
                                                correctAnswer={answer.correctAnswer}
                                                studentAnswer={answer.studentAnswer}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompletedDetails;
