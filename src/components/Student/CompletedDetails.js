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
    FaExclamationTriangle,
    FaHourglassHalf,
    FaLock
} from 'react-icons/fa';
import { flagAnswer } from '../../api/Student/FlagAnswer';
import { getAnswerExplanation } from '../../api/Student/TutorChat';
import '../../styles/Student/CompletedDetails.css';

const GRADE_LABELS = { 5: 'Jeles', 4: 'Jó', 3: 'Közepes', 2: 'Elégséges', 1: 'Elégtelen' };
const TYPE_LABELS = {
    mcq: 'Feleletválasztós',
    true_false: 'Igaz/Hamis',
    short_answer: 'Nyílt végű',
    fill_blank: 'Kiegészítős',
    matching: 'Párosítás',
    ordering: 'Sorba rendezés',
};

const CompletedDetails = () => {
    const location = useLocation();
    const { assignment } = location.state || {};
    const [explanations, setExplanations] = useState({});
    const [loadingExplain, setLoadingExplain] = useState({});
    const [flaggedAnswers, setFlaggedAnswers] = useState({});

    if (!assignment) return <div className="error-state">Adatok nem találhatók.</div>;

    const isGraded = assignment.grade != null;

    const handleAiExplain = async (questionId, questionText, correctAnswer, studentAnswer) => {
        if (explanations[questionId] || loadingExplain[questionId]) return;
        setLoadingExplain(prev => ({ ...prev, [questionId]: true }));
        try {
            const text = await getAnswerExplanation(questionText, correctAnswer, studentAnswer);
            setExplanations(prev => ({ ...prev, [questionId]: text }));
        } catch {
            setExplanations(prev => ({ ...prev, [questionId]: 'Nem sikerült betölteni a magyarázatot. Próbáld újra.' }));
        } finally {
            setLoadingExplain(prev => ({ ...prev, [questionId]: false }));
        }
    };

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

        if (Array.isArray(ans)) {
            return (
                <div className="complex-ans-ordered">
                    {ans.map((item, idx) => (
                        <div key={idx} className="ordered-item">
                            <span className="ordered-num">{idx + 1}</span>
                            <span className="ordered-text">{item}</span>
                        </div>
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
                        {isGraded ? (
                            <div className={`final-grade grade-${assignment.grade}`}>
                                <span className="grade-num">{assignment.grade}</span>
                                <span className="grade-label">{GRADE_LABELS[assignment.grade]}</span>
                            </div>
                        ) : (
                            <div className="pending-grade-badge">
                                <FaHourglassHalf />
                                <span>Javítás alatt</span>
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
                            <span>{new Date(assignment.completedAt).toLocaleDateString('hu-HU')}</span>
                        </div>
                    </div>
                </header>

                {/* Javítás alatt banner */}
                {!isGraded && (
                    <div className="pending-banner">
                        <FaLock className="pending-icon" />
                        <div>
                            <strong>A dolgozat javítás alatt áll</strong>
                            <p>A tanár még nem értékelte a dolgozatot. Addig csak a saját válaszaidat láthatod – a helyes megoldások és a részletes visszajelzés az értékelés után jelenik meg.</p>
                        </div>
                    </div>
                )}

                <div className="answers-review">
                    <h2 className="section-title">
                        {isGraded ? 'Részletes kiértékelés' : 'Beküldött válaszaid'}
                    </h2>
                    <div className="answers-list">
                        {assignment.answers.map((answer, index) => {
                            const isCorrect = isGraded && answer.score === answer.maxPoints;
                            const isFlagged = flaggedAnswers[answer.questionId] || answer.flagged;
                            const explanation = explanations[answer.questionId];
                            const isLoadingExplain = loadingExplain[answer.questionId];

                            return (
                                <div
                                    key={answer.questionId}
                                    className={`review-card ${isGraded ? (isCorrect ? 'correct' : 'wrong') : 'pending'}`}
                                >
                                    <div className="card-top">
                                        <div className="q-info">
                                            <span className="q-num">{index + 1}</span>
                                            <span className="q-type">{TYPE_LABELS[answer.questionType] || answer.questionType}</span>
                                        </div>
                                        {isGraded && (
                                            <div className="score-badge">
                                                {answer.score} / {answer.maxPoints} pont
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="q-text">{answer.questionText}</h3>

                                    {isGraded ? (
                                        /* Értékelés után: saját vs. helyes megoldás */
                                        <div className={`comparison-grid ${['matching','ordering'].includes(answer.questionType) ? 'wide' : ''}`}>
                                            <div className="ans-block student">
                                                <label>Te válaszod</label>
                                                <div className="val">{renderAnswer(answer.studentAnswer, answer.questionType)}</div>
                                            </div>
                                            <div className="ans-block correct">
                                                <label>Helyes megoldás</label>
                                                <div className="val">{renderAnswer(answer.correctAnswer, answer.questionType)}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Javítás alatt: csak saját válasz */
                                        <div className="single-answer-block">
                                            <div className="ans-block student">
                                                <label>A te válaszod</label>
                                                <div className="val">{renderAnswer(answer.studentAnswer, answer.questionType)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Gombok csak értékelés után és CSAK rossz válaszoknál */}
                                    {isGraded && !isCorrect && (
                                        <>
                                            <div className="card-actions">
                                                <button
                                                    className={`tutor-btn ${explanation ? 'explained' : ''}`}
                                                    onClick={() => handleAiExplain(answer.questionId, answer.questionText, answer.correctAnswer, answer.studentAnswer)}
                                                    disabled={isLoadingExplain || !!explanation}
                                                >
                                                    {isLoadingExplain ? '⏳ Magyarázat betöltése...' : explanation ? '✓ AI magyarázat betöltve' : '🤖 Miért volt rossz?'}
                                                </button>
                                                <button
                                                    className={`flag-btn ${isFlagged ? 'active' : ''}`}
                                                    onClick={() => handleFlag(answer.questionId)}
                                                    disabled={isFlagged}
                                                >
                                                    {isFlagged ? '✓ Jelezve a tanárnak' : '⚑ Nem értem a javítást'}
                                                </button>
                                            </div>

                                            {(isLoadingExplain || explanation) && (
                                                <div className="ai-explanation-box">
                                                    {isLoadingExplain ? (
                                                        <div className="ai-explain-loading">
                                                            <span className="ai-explain-dot" /><span className="ai-explain-dot" /><span className="ai-explain-dot" />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="ai-explain-label">🤖 AI magyarázat</div>
                                                            <p className="ai-explain-text">{explanation}</p>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </>
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
