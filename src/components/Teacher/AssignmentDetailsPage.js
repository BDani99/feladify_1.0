import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FaCheck, FaTimes, FaChevronDown, FaChevronUp, FaExclamationTriangle } from 'react-icons/fa';
import { fetchAssignmentSubmissions } from '../../api/Assignments/Teacher/GetSubmissions';
import { overrideScore } from '../../api/Assignments/Teacher/OverrideScore';
import '../../styles/Teacher/AssignmentDetails.css';

const SubmissionAnswerRow = ({ answer, studentId, assignmentId, onScoreUpdate }) => {
    const isMC = answer.confidence === 1.0;
    const isLowConfidence = !isMC && answer.confidence !== null && answer.confidence < 0.7;
    const [overrideVal, setOverrideVal] = useState(answer.score);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleOverride = async () => {
        setSaving(true);
        try {
            await overrideScore(studentId, assignmentId, answer.questionId, overrideVal);
            setSaved(true);
            onScoreUpdate(answer.questionId, Number(overrideVal));
            setTimeout(() => setSaved(false), 2000);
        } catch {
            // silent
        } finally {
            setSaving(false);
        }
    };

    const rowClass = [
        'answer-row',
        isLowConfidence ? 'confidence-low' : '',
        answer.flagged ? 'answer-flagged' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={rowClass}>
            <div className="answer-row-top">
                <span className="answer-q-text">{answer.questionText}</span>
                {!isMC && (
                    <span className={`confidence-badge ${isLowConfidence ? 'low' : 'high'}`}>
                        {isLowConfidence ? (
                            <><FaExclamationTriangle style={{ marginRight: 3 }} />Alacsony konfidencia</>
                        ) : (
                            'AI magabiztos'
                        )}
                    </span>
                )}
                {answer.flagged && (
                    <span className="flagged-badge">Segítséget kér</span>
                )}
            </div>
            <p className="answer-detail">Diák válasza: <span>{answer.studentAnswer || '—'}</span></p>
            <p className="answer-detail">Helyes válasz: <span>{answer.correctAnswer}</span></p>
            <p className="answer-detail">
                Pont: <span>{answer.score} / {answer.maxPoints}</span>
                {isMC && (
                    answer.score > 0
                        ? <FaCheck style={{ color: '#4caf50', marginLeft: 6 }} />
                        : <FaTimes style={{ color: '#e74c3c', marginLeft: 6 }} />
                )}
            </p>
            {!isMC && (
                <div className="override-row">
                    <label>Pontszám felülírása:</label>
                    <input
                        type="number"
                        className="override-input"
                        min="0"
                        max={answer.maxPoints}
                        value={overrideVal}
                        onChange={e => setOverrideVal(e.target.value)}
                    />
                    <button className="override-btn" onClick={handleOverride} disabled={saving}>
                        {saving ? '...' : 'Mentés'}
                    </button>
                    {saved && <span className="override-saved">Elmentve!</span>}
                </div>
            )}
        </div>
    );
};

const StudentSubmissionCard = ({ submission, assignmentId }) => {
    const [open, setOpen] = useState(false);
    const [localPoints, setLocalPoints] = useState(submission.achievedPoints);

    const handleScoreUpdate = (questionId, newScore) => {
        const updated = submission.answers.map(a =>
            String(a.questionId) === String(questionId) ? { ...a, score: newScore } : a
        );
        const total = updated.reduce((s, a) => s + (a.score || 0), 0);
        setLocalPoints(total);
    };

    return (
        <div className="student-submission-card">
            <div className="submission-card-header" onClick={() => setOpen(o => !o)}>
                <span className="submission-student-name">{submission.studentName}</span>
                <span className="submission-points">
                    {localPoints} / {submission.totalPoints} pont
                    {open ? <FaChevronUp style={{ marginLeft: 8 }} /> : <FaChevronDown style={{ marginLeft: 8 }} />}
                </span>
            </div>
            {open && (
                <div className="submission-answers">
                    {submission.answers.map(answer => (
                        <SubmissionAnswerRow
                            key={String(answer.questionId)}
                            answer={answer}
                            studentId={submission.studentId}
                            assignmentId={assignmentId}
                            onScoreUpdate={handleScoreUpdate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const AssignmentDetailsPage = () => {
    const location = useLocation();
    const { assignment } = location.state || {};
    const [activeTab, setActiveTab] = useState('questions');
    const [submissions, setSubmissions] = useState(null);
    const [subLoading, setSubLoading] = useState(false);
    const [subError, setSubError] = useState('');

    if (!assignment) {
        return <div>Nem található dolgozat.</div>;
    }

    const loadSubmissions = async () => {
        if (submissions !== null) return;
        setSubLoading(true);
        setSubError('');
        try {
            const data = await fetchAssignmentSubmissions(assignment._id);
            setSubmissions(data.submissions || []);
        } catch (err) {
            setSubError(err.message || 'Hiba a beküldések lekérésekor.');
        } finally {
            setSubLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'submissions') loadSubmissions();
    };

    return (
        <div id="content">
            <div className="assignment-details-container">
                <div className="assignment-details-header">
                    <h1 className='title'>{assignment.title}</h1>
                    <div className="assignment-meta">
                        <span className="meta-badge">{assignment.subject}</span>
                        <span className="meta-badge">{assignment.difficulty}</span>
                        <span className="meta-badge">{assignment.questions?.length || 0} kérdés</span>
                        {assignment.completedCount > 0 && (
                            <span className="meta-badge">{assignment.completedCount} beküldés</span>
                        )}
                    </div>
                </div>

                <div className="details-tabs">
                    <button
                        className={`details-tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
                        onClick={() => handleTabChange('questions')}
                    >
                        Kérdések
                    </button>
                    <button
                        className={`details-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
                        onClick={() => handleTabChange('submissions')}
                    >
                        Diákok válaszai{assignment.completedCount > 0 ? ` (${assignment.completedCount})` : ''}
                    </button>
                </div>

                {activeTab === 'questions' && (
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
                )}

                {activeTab === 'submissions' && (
                    <div className="submissions-container">
                        {subLoading && <p style={{ color: 'var(--color-text-dim)' }}>Betöltés...</p>}
                        {subError && <p className="error-message">{subError}</p>}
                        {!subLoading && submissions !== null && submissions.length === 0 && (
                            <p style={{ color: 'var(--color-text-dim)' }}>Még nem küldött be senki.</p>
                        )}
                        {!subLoading && submissions?.map(sub => (
                            <StudentSubmissionCard
                                key={String(sub.studentId)}
                                submission={sub}
                                assignmentId={assignment._id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssignmentDetailsPage;
