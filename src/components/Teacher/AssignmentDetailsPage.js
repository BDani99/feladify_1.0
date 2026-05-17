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
    FaBookOpen,
    FaFlag,
    FaPlus,
    FaTrash,
    FaArrowUp,
    FaArrowDown,
    FaSave,
    FaBan,
    FaReply,
} from 'react-icons/fa';
import { fetchAssignmentSubmissions } from '../../api/Assignments/Teacher/GetSubmissions';
import { overrideScore } from '../../api/Assignments/Teacher/OverrideScore';
import { finalizeGrade } from '../../api/Assignments/Teacher/FinalizeGrade';
import { updateQuestion } from '../../api/Assignments/Teacher/UpdateQuestion';
import { fetchFlaggedAnswers } from '../../api/Assignments/Teacher/GetFlaggedAnswers';
import { resolveFlaggedAnswer } from '../../api/Assignments/Teacher/ResolveFlaggedAnswer';
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

// ────────────────────────────────────────────────────────────
// Kérdés szerkesztő (típusonként)
// ────────────────────────────────────────────────────────────
const QuestionEditor = ({ question, assignmentId, onSaved, onCancel }) => {
    const [questionText, setQuestionText] = useState(question.questionText || '');
    const [points, setPoints] = useState(question.points || 1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // MCQ state
    const [options, setOptions] = useState(
        question.questionType === 'mcq' ? [...(question.options || [])] : []
    );
    const [correctMcq, setCorrectMcq] = useState(question.correctAnswer || '');

    // True/False
    const [correctTF, setCorrectTF] = useState(
        question.questionType === 'true_false' ? String(question.correctAnswer) : 'true'
    );

    // Short/Fill
    const [correctText, setCorrectText] = useState(
        ['short_answer', 'fill_blank'].includes(question.questionType)
            ? String(question.correctAnswer || '')
            : ''
    );

    // Matching
    const [pairs, setPairs] = useState(
        question.questionType === 'matching'
            ? [...(question.pairs || [{ left: '', right: '' }])]
            : []
    );

    // Ordering
    const [ordItems, setOrdItems] = useState(
        question.questionType === 'ordering'
            ? [...(question.items || question.correctAnswer || [])]
            : []
    );

    const buildPayload = () => {
        const base = { questionText: questionText.trim(), points: Number(points) };
        switch (question.questionType) {
            case 'mcq':
                return { ...base, options, correctAnswer: correctMcq };
            case 'true_false':
                return { ...base, correctAnswer: correctTF === 'true' ? 'Igaz' : 'Hamis' };
            case 'short_answer':
            case 'fill_blank':
                return { ...base, correctAnswer: correctText };
            case 'matching': {
                const ca = {};
                pairs.forEach(p => { if (p.left && p.right) ca[p.left] = p.right; });
                return { ...base, pairs, correctAnswer: ca };
            }
            case 'ordering':
                return { ...base, items: ordItems, correctAnswer: ordItems };
            default:
                return base;
        }
    };

    const handleSave = async () => {
        if (!questionText.trim()) { setError('A kérdés szövege nem lehet üres.'); return; }
        setSaving(true);
        setError('');
        try {
            const payload = buildPayload();
            const result = await updateQuestion(assignmentId, question._id, payload);
            onSaved({ ...question, ...payload, _id: question._id });
        } catch (e) {
            setError(e.message || 'Hiba a mentés során.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="question-editor-box">
            <div className="editor-field">
                <label>Kérdés szövege</label>
                <textarea value={questionText} onChange={e => setQuestionText(e.target.value)} rows={3} />
            </div>

            {/* MCQ */}
            {question.questionType === 'mcq' && (
                <div className="editor-field">
                    <label>Válaszlehetőségek <span className="field-hint">(jelöld be a helyeset)</span></label>
                    {options.map((opt, i) => (
                        <div key={i} className="editor-option-row">
                            <input
                                type="radio"
                                name="correct-mcq"
                                checked={correctMcq === opt}
                                onChange={() => setCorrectMcq(opt)}
                            />
                            <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                    const updated = [...options];
                                    if (correctMcq === opt) setCorrectMcq(e.target.value);
                                    updated[i] = e.target.value;
                                    setOptions(updated);
                                }}
                            />
                            <button type="button" className="icon-btn danger" onClick={() => {
                                const updated = options.filter((_, idx) => idx !== i);
                                setOptions(updated);
                                if (correctMcq === opt) setCorrectMcq('');
                            }}><FaTrash /></button>
                        </div>
                    ))}
                    <button type="button" className="add-item-btn" onClick={() => setOptions([...options, ''])}>
                        <FaPlus /> Válaszlehetőség hozzáadása
                    </button>
                </div>
            )}

            {/* True/False */}
            {question.questionType === 'true_false' && (
                <div className="editor-field">
                    <label>Helyes válasz</label>
                    <div className="tf-toggle">
                        <button type="button" className={`tf-btn ${correctTF === 'true' ? 'active' : ''}`} onClick={() => setCorrectTF('true')}>Igaz</button>
                        <button type="button" className={`tf-btn ${correctTF === 'false' ? 'active' : ''}`} onClick={() => setCorrectTF('false')}>Hamis</button>
                    </div>
                </div>
            )}

            {/* Short answer / Fill blank */}
            {(question.questionType === 'short_answer' || question.questionType === 'fill_blank') && (
                <div className="editor-field">
                    <label>Helyes válasz</label>
                    <textarea value={correctText} onChange={e => setCorrectText(e.target.value)} rows={2} />
                </div>
            )}

            {/* Matching */}
            {question.questionType === 'matching' && (
                <div className="editor-field">
                    <label>Párok <span className="field-hint">(bal → jobb)</span></label>
                    {pairs.map((pair, i) => (
                        <div key={i} className="editor-pair-row">
                            <input type="text" placeholder="Bal oldal" value={pair.left}
                                onChange={e => { const p = [...pairs]; p[i] = { ...p[i], left: e.target.value }; setPairs(p); }} />
                            <span className="pair-arrow">→</span>
                            <input type="text" placeholder="Jobb oldal" value={pair.right}
                                onChange={e => { const p = [...pairs]; p[i] = { ...p[i], right: e.target.value }; setPairs(p); }} />
                            <button type="button" className="icon-btn danger" onClick={() => setPairs(pairs.filter((_, idx) => idx !== i))}><FaTrash /></button>
                        </div>
                    ))}
                    <button type="button" className="add-item-btn" onClick={() => setPairs([...pairs, { left: '', right: '' }])}>
                        <FaPlus /> Pár hozzáadása
                    </button>
                </div>
            )}

            {/* Ordering */}
            {question.questionType === 'ordering' && (
                <div className="editor-field">
                    <label>Elemek sorrendben <span className="field-hint">(ez lesz a helyes sorrend)</span></label>
                    {ordItems.map((item, i) => (
                        <div key={i} className="editor-order-row">
                            <span className="order-num">{i + 1}</span>
                            <input type="text" value={item}
                                onChange={e => { const it = [...ordItems]; it[i] = e.target.value; setOrdItems(it); }} />
                            <button type="button" className="icon-btn" disabled={i === 0}
                                onClick={() => { const it = [...ordItems]; [it[i - 1], it[i]] = [it[i], it[i - 1]]; setOrdItems(it); }}>
                                <FaArrowUp />
                            </button>
                            <button type="button" className="icon-btn" disabled={i === ordItems.length - 1}
                                onClick={() => { const it = [...ordItems]; [it[i], it[i + 1]] = [it[i + 1], it[i]]; setOrdItems(it); }}>
                                <FaArrowDown />
                            </button>
                            <button type="button" className="icon-btn danger" onClick={() => setOrdItems(ordItems.filter((_, idx) => idx !== i))}><FaTrash /></button>
                        </div>
                    ))}
                    <button type="button" className="add-item-btn" onClick={() => setOrdItems([...ordItems, ''])}>
                        <FaPlus /> Elem hozzáadása
                    </button>
                </div>
            )}

            <div className="editor-field">
                <label>Pontszám</label>
                <input type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} className="points-input" />
            </div>

            {error && <div className="editor-error">{error}</div>}

            <div className="editor-actions">
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? '...' : <><FaSave /> Mentés</>}
                </button>
                <button className="btn-cancel" onClick={onCancel}><FaBan /> Mégse</button>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Beküldött válasz sor (grading nézetben)
// ────────────────────────────────────────────────────────────
const SubmissionAnswerRow = ({ answer, studentId, assignmentId, onScoreUpdate }) => {
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
        if (type === 'matching') return Object.entries(ans).map(([k, v]) => `${k} → ${v}`).join(', ');
        if (type === 'ordering') return ans.join(' → ');
        return String(ans);
    };

    return (
        <div className={`answer-row ${isLowConfidence ? 'low-conf' : ''} ${answer.flagged ? 'flagged-row' : ''}`}>
            <div className="answer-row-header">
                <div className="q-text">{answer.questionText}</div>
                {answer.flagged && (
                    <span className="flagged-badge"><FaFlag /> Reklamáció</span>
                )}
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
                    <input type="number" min="0" max={answer.maxPoints} value={overrideVal}
                        onChange={e => setOverrideVal(e.target.value)} />
                    <button onClick={handleOverride} disabled={saving}>
                        {saving ? '...' : <FaEdit />}
                    </button>
                    {saved && <span className="saved-msg">✓</span>}
                </div>
            </div>

            {(answer.aiFeedback || answer.questionType === 'short_answer') && (
                <div className="answer-ai-section">
                    <FaBrain className="ai-icon" />
                    <span className="ai-label">AI értékelés:</span>
                    <span className="ai-text">{answer.aiFeedback || '—'}</span>
                    {answer.confidence !== null && answer.confidence !== undefined && (
                        <span className={`confidence-badge ${isLowConfidence ? 'low' : 'high'}`}>
                            {isLowConfidence && <FaExclamationTriangle className="conf-warn-icon" />}
                            {Math.round(answer.confidence * 100)}% bizonyosság
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Diák beküldés kártya
// ────────────────────────────────────────────────────────────
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
        setLocalPoints(updated.reduce((s, a) => s + (a.score || 0), 0));
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
    const hasFlagged = submission.answers.some(a => a.flagged);

    return (
        <div className={`submission-card ${open ? 'open' : ''}`}>
            <div className="card-summary" onClick={() => setOpen(!open)}>
                <div className="student-info">
                    <div className="avatar">{submission.studentName.charAt(0)}</div>
                    <div>
                        <div className="name">
                            {submission.studentName}
                            {hasFlagged && <span className="flag-indicator" title="Van reklamáció"><FaFlag /></span>}
                        </div>
                        <div className="date">{new Date(submission.completedAt).toLocaleString('hu-HU')}</div>
                    </div>
                </div>

                <div className="submission-stats">
                    <div className="stat-item"><span className="label">Eredmény</span><span className="val">{localPoints} / {submission.totalPoints}</span></div>
                    <div className="stat-item"><span className="label">Százalék</span><span className="val">{percentage}%</span></div>
                    <div className="stat-item"><span className="label">Javasolt jegy</span><span className="val suggested">{submission.suggestedGrade}</span></div>
                </div>

                <div className="grade-buttons-group" onClick={e => e.stopPropagation()}>
                    {[1, 2, 3, 4, 5].map(g => (
                        <button key={g} type="button"
                            className={`grade-btn grade-btn-${g} ${grade === String(g) ? 'active' : ''}`}
                            onClick={() => setGrade(String(g))}
                            title={['Elégtelen', 'Elégséges', 'Közepes', 'Jó', 'Jeles'][g - 1]}>
                            {g}
                        </button>
                    ))}
                    <button className={`save-grade-btn ${gradeSaved ? 'saved' : ''}`}
                        onClick={handleGradeSave} disabled={gradeSaving || !grade}>
                        {gradeSaving ? '...' : (gradeSaved ? <FaCheckCircle /> : <FaCheck />)}
                    </button>
                </div>

                <div className="expand-icon">{open ? <FaChevronUp /> : <FaChevronDown />}</div>
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

// ────────────────────────────────────────────────────────────
// Reklamáció kártya (egy diák jelzett kérdései)
// ────────────────────────────────────────────────────────────
const FlaggedSubmissionCard = ({ studentId, studentName, flaggedAnswers, assignmentId, onResolved }) => {
    const [open, setOpen] = useState(true);
    const [responseTexts, setResponseTexts] = useState({});
    const [saving, setSaving] = useState({});
    const [localAnswers, setLocalAnswers] = useState(flaggedAnswers);

    const renderAnswer = (ans, type) => {
        if (ans === null || ans === undefined) return '—';
        if (typeof ans === 'object' && !Array.isArray(ans)) {
            return Object.entries(ans).map(([k, v]) => `${k} → ${v}`).join(', ');
        }
        if (Array.isArray(ans)) return ans.join(' → ');
        return String(ans);
    };

    const handleResolve = async (questionId, rejected) => {
        setSaving(prev => ({ ...prev, [questionId]: true }));
        try {
            const responseText = responseTexts[questionId] || '';
            await resolveFlaggedAnswer(studentId, assignmentId, questionId, responseText, rejected);
            setLocalAnswers(prev => prev.map(a =>
                String(a.questionId) === String(questionId)
                    ? { ...a, flagRejected: rejected, flagResponse: rejected ? '' : responseText }
                    : a
            ));
            onResolved?.();
        } catch (e) {
            alert(e.message || 'Hiba a reklamáció kezelésekor.');
        } finally {
            setSaving(prev => ({ ...prev, [questionId]: false }));
        }
    };

    const pendingCount = localAnswers.filter(a => !a.flagResponse && !a.flagRejected).length;

    return (
        <div className="flagged-student-card">
            <div className="flagged-card-header" onClick={() => setOpen(!open)}>
                <div className="flagged-student-info">
                    <div className="avatar">{studentName.charAt(0)}</div>
                    <div>
                        <div className="name">{studentName}</div>
                        <div className="flag-count">
                            {pendingCount > 0
                                ? <span className="pending-flag">{pendingCount} megválaszolatlan reklamáció</span>
                                : <span className="resolved-flag">Minden reklamáció kezelve</span>}
                        </div>
                    </div>
                </div>
                <div className="expand-icon">{open ? <FaChevronUp /> : <FaChevronDown />}</div>
            </div>

            {open && (
                <div className="flagged-answers-list">
                    {localAnswers.map(ans => {
                        const isResolved = ans.flagResponse || ans.flagRejected;
                        return (
                            <div key={String(ans.questionId)} className={`flagged-answer-item ${isResolved ? 'resolved' : ''}`}>
                                <div className="flagged-q-text">{ans.questionText}</div>

                                <div className="flagged-comparison">
                                    <div className="ans-block student">
                                        <label>Diák válasza</label>
                                        <div className="val">{renderAnswer(ans.studentAnswer, ans.questionType)}</div>
                                    </div>
                                    <div className="ans-block correct">
                                        <label>Helyes válasz</label>
                                        <div className="val">{renderAnswer(ans.correctAnswer, ans.questionType)}</div>
                                    </div>
                                </div>

                                <div className="flagged-score">
                                    Pontszám: <strong>{ans.score} / {ans.maxPoints}</strong>
                                </div>

                                {isResolved ? (
                                    <div className={`resolved-status ${ans.flagRejected ? 'rejected' : 'answered'}`}>
                                        {ans.flagRejected
                                            ? <><FaBan /> Reklamáció elutasítva</>
                                            : <><FaCheckCircle /> Megválaszolva: „{ans.flagResponse}"</>}
                                    </div>
                                ) : (
                                    <div className="resolve-controls">
                                        <textarea
                                            placeholder="Írj választ a diáknak (opcionális az elutasításhoz)..."
                                            value={responseTexts[String(ans.questionId)] || ''}
                                            onChange={e => setResponseTexts(prev => ({ ...prev, [String(ans.questionId)]: e.target.value }))}
                                            rows={2}
                                        />
                                        <div className="resolve-btns">
                                            <button
                                                className="btn-respond"
                                                disabled={saving[String(ans.questionId)] || !responseTexts[String(ans.questionId)]?.trim()}
                                                onClick={() => handleResolve(String(ans.questionId), false)}
                                            >
                                                <FaReply /> Megválaszol
                                            </button>
                                            <button
                                                className="btn-reject"
                                                disabled={saving[String(ans.questionId)]}
                                                onClick={() => handleResolve(String(ans.questionId), true)}
                                            >
                                                <FaBan /> Elutasít
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ────────────────────────────────────────────────────────────
// Fő komponens
// ────────────────────────────────────────────────────────────
const AssignmentDetailsPage = () => {
    const location = useLocation();
    const { assignment: initAssignment } = location.state || {};
    const [assignment, setAssignment] = useState(initAssignment);

    const [activeTab, setActiveTab] = useState('questions');
    const [submissions, setSubmissions] = useState(null);
    const [subLoading, setSubLoading] = useState(false);
    const [subError, setSubError] = useState('');
    const [subView, setSubView] = useState('pending'); // 'pending' | 'graded' | 'flagged'

    const [flaggedData, setFlaggedData] = useState(null);
    const [flaggedLoading, setFlaggedLoading] = useState(false);

    const [editingQuestionId, setEditingQuestionId] = useState(null);

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

    const loadFlaggedAnswers = async () => {
        if (flaggedData !== null) return;
        setFlaggedLoading(true);
        try {
            const data = await fetchFlaggedAnswers();
            const forThis = (data.flaggedByAssignment || []).find(
                item => String(item.assignmentId) === String(assignment._id)
            );
            setFlaggedData(forThis ? forThis.flaggedSubmissions : []);
        } catch {
            setFlaggedData([]);
        } finally {
            setFlaggedLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'submissions') {
            loadSubmissions();
        }
    };

    const handleSubViewChange = (view) => {
        setSubView(view);
        if (view === 'flagged') loadFlaggedAnswers();
    };

    const handleQuestionSaved = (updatedQ) => {
        setAssignment(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                String(q._id) === String(updatedQ._id) ? { ...q, ...updatedQ } : q
            ),
        }));
        setEditingQuestionId(null);
    };

    const flaggedCount = flaggedData?.reduce((sum, s) => sum + s.flaggedAnswers.length, 0) ?? 0;
    const pendingFlagCount = flaggedData?.reduce(
        (sum, s) => sum + s.flaggedAnswers.filter(a => !a.flagResponse && !a.flagRejected).length, 0
    ) ?? 0;

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
                    <button className={activeTab === 'questions' ? 'active' : ''} onClick={() => handleTabChange('questions')}>
                        <FaQuestionCircle /> Kérdéssor
                    </button>
                    <button className={activeTab === 'submissions' ? 'active' : ''} onClick={() => handleTabChange('submissions')}>
                        <FaUserGraduate /> Beküldések
                    </button>
                </div>

                <div className="tab-content">
                    {/* ── Kérdéssor fül ── */}
                    {activeTab === 'questions' && (
                        <div className="questions-grid">
                            {assignment.questions?.map((q, idx) => (
                                <div key={String(q._id || idx)} className={`question-item-card ${editingQuestionId === String(q._id) ? 'editing' : ''}`}>
                                    {editingQuestionId === String(q._id) ? (
                                        <QuestionEditor
                                            question={q}
                                            assignmentId={assignment._id}
                                            onSaved={handleQuestionSaved}
                                            onCancel={() => setEditingQuestionId(null)}
                                        />
                                    ) : (
                                        <>
                                            <div className="q-header">
                                                <span className="q-num">{idx + 1}</span>
                                                <span className="q-type">{TYPE_LABELS[q.questionType] || q.questionType}</span>
                                                <span className="q-pts">{q.points} pont</span>
                                                <button
                                                    className="q-edit-btn"
                                                    title="Kérdés szerkesztése"
                                                    onClick={() => setEditingQuestionId(String(q._id))}
                                                >
                                                    <FaEdit />
                                                </button>
                                            </div>
                                            <div className="q-text">{q.questionText}</div>

                                            {q.questionType === 'mcq' && q.options?.length > 0 && (
                                                <div className="q-options-preview">
                                                    {q.options.map((opt, oi) => (
                                                        <span key={oi} className={`opt-chip ${opt === q.correctAnswer ? 'correct' : ''}`}>{opt}</span>
                                                    ))}
                                                </div>
                                            )}

                                            {q.questionType === 'matching' && q.pairs?.length > 0 && (
                                                <div className="q-pairs-preview">
                                                    {q.pairs.map((p, pi) => (
                                                        <span key={pi} className="pair-chip">{p.left} → {p.right}</span>
                                                    ))}
                                                </div>
                                            )}

                                            {q.questionType === 'ordering' && (
                                                <div className="q-ordering-preview">
                                                    {(q.items || q.correctAnswer || []).map((item, ii) => (
                                                        <span key={ii} className="order-chip"><span className="order-n">{ii + 1}</span>{item}</span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="q-correct-box">
                                                <label>Helyes megoldás:</label>
                                                <div className="val">{formatCorrectAnswer(q)}</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Beküldések fül ── */}
                    {activeTab === 'submissions' && (
                        <div className="submissions-view">
                            <div className="sub-tabs">
                                <button className={subView === 'pending' ? 'active' : ''} onClick={() => handleSubViewChange('pending')}>
                                    Javítandó ({submissions?.filter(s => !s.grade).length || 0})
                                </button>
                                <button className={subView === 'graded' ? 'active' : ''} onClick={() => handleSubViewChange('graded')}>
                                    Értékelt ({submissions?.filter(s => s.grade).length || 0})
                                </button>
                                <button className={`${subView === 'flagged' ? 'active' : ''} flag-tab-btn`} onClick={() => handleSubViewChange('flagged')}>
                                    <FaFlag />
                                    Reklamációk
                                    {pendingFlagCount > 0 && <span className="flag-tab-badge">{pendingFlagCount}</span>}
                                </button>
                            </div>

                            <div className="submissions-list">
                                {/* Javítandó / Értékelt */}
                                {(subView === 'pending' || subView === 'graded') && (
                                    <>
                                        {subLoading && <div className="loading-box">Beküldések betöltése...</div>}
                                        {subError && <div className="error-box">{subError}</div>}
                                        {!subLoading && (
                                            (subView === 'graded'
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
                                        {!subLoading && (subView === 'graded'
                                            ? submissions?.filter(s => s.grade)
                                            : submissions?.filter(s => !s.grade))?.length === 0 && (
                                            <div className="empty-box">Nincs megjeleníthető beküldés ebben a kategóriában.</div>
                                        )}
                                    </>
                                )}

                                {/* Reklamációk */}
                                {subView === 'flagged' && (
                                    <>
                                        {flaggedLoading && <div className="loading-box">Reklamációk betöltése...</div>}
                                        {!flaggedLoading && flaggedData?.length === 0 && (
                                            <div className="empty-box">
                                                <FaFlag style={{ marginRight: 8, opacity: 0.4 }} />
                                                Ehhez a dolgozathoz nincs reklamáció.
                                            </div>
                                        )}
                                        {!flaggedLoading && flaggedData?.map(s => (
                                            <FlaggedSubmissionCard
                                                key={String(s.studentId)}
                                                studentId={String(s.studentId)}
                                                studentName={s.studentName}
                                                flaggedAnswers={s.flaggedAnswers}
                                                assignmentId={assignment._id}
                                                onResolved={() => {
                                                    // refresh flag count
                                                    setFlaggedData(prev => prev ? [...prev] : prev);
                                                }}
                                            />
                                        ))}
                                    </>
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
