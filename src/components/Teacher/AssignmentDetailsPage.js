import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    FaCheck, 
    FaTimes, 
    FaChevronDown, 
    FaChevronUp, 
    FaExclamationTriangle, 
    FaUserGraduate, 
    FaQuestionCircle, 
    FaEdit, 
    FaCheckCircle,
    FaBrain,
    FaArrowRight,
    FaBookOpen
} from 'react-icons/fa';
import { fetchAssignmentSubmissions } from '../../api/Assignments/Teacher/GetSubmissions';
import { overrideScore } from '../../api/Assignments/Teacher/OverrideScore';
import { finalizeGrade } from '../../api/Assignments/Teacher/FinalizeGrade';
import '../../styles/Teacher/AssignmentDetailsPage.css';

const TYPE_LABELS = {
    mcq: 'Feleletválasztós',
    true_false: 'Igaz/Hamis',
    short_answer: 'Nyílt végű',
    fill_blank: 'Kiegészítős',
    matching: 'Párosítás',
    ordering: 'Sorba rendezés',
};

const formatCorrectAnswer = (q) => {
    const ca = q.correctAnswer;
    if (ca === null || ca === undefined) return '—';
    if (typeof ca === 'object' && !Array.isArray(ca)) {
        return Object.entries(ca).map(([k, v]) => `${k} → ${v}`).join(' | ');
    }
    if (Array.isArray(ca)) return ca.join(' → ');
    return String(ca);
};

const SubmissionAnswerRow = ({ answer, studentId, assignmentId, onScoreUpdate }) => {
    const isManual = answer.questionType === 'short_answer';
    const isLowConfidence = answer.confidence !== null && answer.confidence < 0.7;
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

    const renderAnswer = (ans, type) => {
        if (!ans) return '—';
        if (type === 'matching') {
            return Object.entries(ans).map(([key, val]) => `${key} → ${val}`).join(', ');
        }
        if (type === 'ordering') {
            return ans.join(' → ');
        }
        return String(ans);
    };

    return (
        <div className={`answer-row ${isLowConfidence ? 'low-conf' : ''}`}>
            <div className="answer-row-header">
                <div className="q-text">{answer.questionText}</div>
            </div>

            <div className="answer-comparison">
                <div className="answer-box student">
                    <label>Diák válasza</label>
                    <div className="ans-val">{renderAnswer(answer.studentAnswer, answer.questionType)}</div>
                </div>
                <div className="answer-box correct">
                    <label>Helyes válasz</label>
                    <div className="ans-val">{renderAnswer(answer.correctAnswer, answer.questionType)}</div>
                </div>
            </div>

            <div className="answer-footer">
                <div className="score-status">
                    Pontszám: <strong>{answer.score} / {answer.maxPoints}</strong>
                    {answer.score === answer.maxPoints ? <FaCheckCircle className="icon-success" /> : <FaTimes className="icon-error" />}
                </div>

                <div className="override-controls">
                    <input
                        type="number"
                        min="0"
                        max={answer.maxPoints}
                        value={overrideVal}
                        onChange={e => setOverrideVal(e.target.value)}
                    />
                    <button onClick={handleOverride} disabled={saving}>
                        {saving ? '...' : <FaEdit />}
                    </button>
                    {saved && <span className="saved-msg">✓</span>}
                </div>
            </div>

            {answer.aiFeedback && (
                <div className="answer-ai-section">
                    <FaBrain className="ai-icon" />
                    <span className="ai-label">AI értékelés:</span>
                    <span className="ai-text">{answer.aiFeedback}</span>
                </div>
            )}
        </div>
    );
};

const StudentSubmissionCard = ({ submission, assignmentId, onGradeFinalized }) => {
    const [open, setOpen] = useState(false);
    const [localPoints, setLocalPoints] = useState(submission.achievedPoints);
    const [grade, setGrade] = useState(submission.grade || '');
    const [gradeSaving, setGradeSaving] = useState(false);
    const [gradeSaved, setGradeSaved] = useState(false);

    const handleScoreUpdate = (questionId, newScore) => {
        const updated = submission.answers.map(a =>
            String(a.questionId) === String(questionId) ? { ...a, score: newScore } : a
        );
        const total = updated.reduce((s, a) => s + (a.score || 0), 0);
        setLocalPoints(total);
    };

    const handleGradeSave = async () => {
        if (!grade) return;
        setGradeSaving(true);
        try {
            await finalizeGrade(submission.studentId, assignmentId, grade);
            setGradeSaved(true);
            onGradeFinalized(Number(grade));
            setTimeout(() => setGradeSaved(false), 3000);
        } catch (err) {
            alert(err.message);
        } finally {
            setGradeSaving(false);
        }
    };

    const percentage = Math.round((localPoints / submission.totalPoints) * 100);

    return (
        <div className={`submission-card ${open ? 'open' : ''}`}>
            <div className="card-summary" onClick={() => setOpen(!open)}>
                <div className="student-info">
                    <div className="avatar">{submission.studentName.charAt(0)}</div>
                    <div>
                        <div className="name">{submission.studentName}</div>
                        <div className="date">{new Date(submission.completedAt).toLocaleString('hu-HU')}</div>
                    </div>
                </div>

                <div className="submission-stats">
                    <div className="stat-item">
                        <span className="label">Eredmény</span>
                        <span className="val">{localPoints} / {submission.totalPoints}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Százalék</span>
                        <span className="val">{percentage}%</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Javasolt jegy</span>
                        <span className="val suggested">{submission.suggestedGrade}</span>
                    </div>
                </div>

                <div className="grade-buttons-group" onClick={e => e.stopPropagation()}>
                    {[1, 2, 3, 4, 5].map(g => (
                        <button
                            key={g}
                            type="button"
                            className={`grade-btn grade-btn-${g} ${grade === String(g) ? 'active' : ''}`}
                            onClick={() => setGrade(String(g))}
                            title={['Elégtelen', 'Elégséges', 'Közepes', 'Jó', 'Jeles'][g - 1]}
                        >
                            {g}
                        </button>
                    ))}
                    <button
                        className={`save-grade-btn ${gradeSaved ? 'saved' : ''}`}
                        onClick={handleGradeSave}
                        disabled={gradeSaving || !grade}
                    >
                        {gradeSaving ? '...' : (gradeSaved ? <FaCheckCircle /> : <FaCheck />)}
                    </button>
                </div>

                <div className="expand-icon">
                    {open ? <FaChevronUp /> : <FaChevronDown />}
                </div>
            </div>

            {open && (
                <div className="card-details-expanded">
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
    const [showGraded, setShowGraded] = useState(false);

    if (!assignment) return <div className="error-state">Dolgozat nem található.</div>;

    const loadSubmissions = async () => {
        if (submissions !== null) return;
        setSubLoading(true);
        try {
            const data = await fetchAssignmentSubmissions(assignment._id);
            setSubmissions(data.submissions || []);
        } catch (err) {
            setSubError(err.message || 'Hiba a lekérés során.');
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
            <div className="assignment-details-premium">
                <header className="details-header">
                    <div className="header-top">
                        <h1 className="title">{assignment.title}</h1>
                        <div className={`status-pill ${assignment.completedCount > 0 ? 'active' : ''}`}>
                            {assignment.completedCount > 0 ? 'Kitöltve' : 'Folyamatban'}
                        </div>
                    </div>
                    <div className="meta-row">
                        <span className="meta-item"><FaBookOpen /> {assignment.subject}</span>
                        <span className="meta-item"><FaBrain /> {assignment.difficulty}</span>
                        <span className="meta-item"><FaQuestionCircle /> {assignment.questions?.length || 0} kérdés</span>
                        <span className="meta-item"><FaUserGraduate /> {assignment.completedCount} beküldés</span>
                    </div>
                </header>

                <div className="tabs-navigation">
                    <button 
                        className={activeTab === 'questions' ? 'active' : ''} 
                        onClick={() => handleTabChange('questions')}
                    >
                        <FaQuestionCircle /> Kérdéssor
                    </button>
                    <button 
                        className={activeTab === 'submissions' ? 'active' : ''} 
                        onClick={() => handleTabChange('submissions')}
                    >
                        <FaUserGraduate /> Beküldések
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'questions' && (
                        <div className="questions-grid">
                            {assignment.questions?.map((q, idx) => (
                                <div key={idx} className="question-item-card">
                                    <div className="q-header">
                                        <span className="q-num">{idx + 1}</span>
                                        <span className="q-type">{TYPE_LABELS[q.questionType] || q.questionType}</span>
                                        <span className="q-pts">{q.points} pont</span>
                                    </div>
                                    <div className="q-text">{q.questionText}</div>
                                    <div className="q-correct-box">
                                        <label>Helyes megoldás:</label>
                                        <div className="val">
                                            {formatCorrectAnswer(q)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'submissions' && (
                        <div className="submissions-view">
                            <div className="sub-tabs">
                                <button 
                                    className={!showGraded ? 'active' : ''} 
                                    onClick={() => setShowGraded(false)}
                                >
                                    Javítandó ({submissions?.filter(s => !s.grade).length || 0})
                                </button>
                                <button 
                                    className={showGraded ? 'active' : ''} 
                                    onClick={() => setShowGraded(true)}
                                >
                                    Értékelt ({submissions?.filter(s => s.grade).length || 0})
                                </button>
                            </div>

                            <div className="submissions-list">
                                {subLoading && <div className="loading-box">Beküldések betöltése...</div>}
                                {subError && <div className="error-box">{subError}</div>}
                                {!subLoading && (
                                    (showGraded 
                                        ? submissions?.filter(s => s.grade) 
                                        : submissions?.filter(s => !s.grade)
                                    )?.map(sub => (
                                        <StudentSubmissionCard 
                                            key={sub.studentId} 
                                            submission={sub} 
                                            assignmentId={assignment._id} 
                                            onGradeFinalized={(newGrade) => {
                                                setSubmissions(prev => prev.map(s => 
                                                    s.studentId === sub.studentId ? { ...s, grade: newGrade } : s
                                                ));
                                            }}
                                        />
                                    ))
                                )}
                                {!subLoading && (showGraded ? submissions?.filter(s => s.grade) : submissions?.filter(s => !s.grade))?.length === 0 && (
                                    <div className="empty-box">Nincs megjeleníthető beküldés ebben a kategóriában.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssignmentDetailsPage;
