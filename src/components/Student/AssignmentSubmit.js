import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { submitAssignment, autosaveAssignment } from '../../api/Assignments/Student/SubmitAssignment';
import { 
    FaExclamationCircle, 
    FaCheckCircle, 
    FaClock, 
    FaPaperPlane, 
    FaArrowRight, 
    FaArrowLeft
} from 'react-icons/fa';
import '../../styles/Student/AssignmentSubmit.css';

const AssignmentSubmitForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { assignment } = location.state || {};
    
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [dragOverIdx, setDragOverIdx] = useState(null);

    useEffect(() => {
        if (!assignment) {
            setError('Dolgozat nem található.');
            return;
        }

        // Timer initialization
        if (assignment.timeLimit) {
            setTimeLeft(assignment.timeLimit * 60);
        }

        // Initialize complex answers
        const initialAnswers = {};
        assignment.questions.forEach(q => {
            if (q.questionType === 'ordering') initialAnswers[q._id] = [...q.items];
            if (q.questionType === 'matching') initialAnswers[q._id] = {};
        });
        setAnswers(initialAnswers);
    }, [assignment]);

    // Debounced autosave effect
    useEffect(() => {
        if (!assignment || Object.keys(answers).length === 0) return;

        const delayDebounceFn = setTimeout(async () => {
            try {
                await autosaveAssignment(assignment._id, answers);
            } catch (err) {
                console.warn('Autosave failed:', err);
            }
        }, 3000);

        return () => clearTimeout(delayDebounceFn);
    }, [answers, assignment]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleSubmit = useCallback(async (e) => {
        if (e) e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError('');

        try {
            await submitAssignment(assignment._id, answers);
            navigate('/megoldott-dolgozatok', { state: { justSubmitted: true } });
        } catch (err) {
            setError(err.message || 'Hiba történt a beküldés során.');
            setIsSubmitting(false);
        }
    }, [assignment, answers, isSubmitting, navigate]);

    useEffect(() => {
        if (timeLeft === null) return;
        if (timeLeft <= 0) {
            handleSubmit();
            return;
        }
        const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, handleSubmit]);

    const currentQuestion = assignment?.questions?.[currentStep];
    const isLastStep = currentStep === (assignment?.questions?.length || 0) - 1;

    const isQuestionAnswered = (q) => {
        const answer = answers[q._id];
        if (q.questionType === 'matching') {
            const leftValues = (q.pairs || []).map(pair => pair.left);
            return leftValues.length > 0 && leftValues.every(left => answer?.[left]);
        }
        if (q.questionType === 'ordering') {
            if (!Array.isArray(answer) || !Array.isArray(q.items)) return false;
            return answer.length === q.items.length && answer.some((item, idx) => item !== q.items[idx]);
        }
        if (Array.isArray(answer)) return answer.length > 0;
        return String(answer || '').trim().length > 0;
    };

    // Shuffle matching right side once per question
    const shuffledMatchingRight = React.useMemo(() => {
        if (!currentQuestion || currentQuestion.questionType !== 'matching') return [];
        const options = Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0
            ? currentQuestion.options
            : (currentQuestion.pairs || []).map(p => p.right).filter(Boolean);
        return [...options].sort(() => Math.random() - 0.5);
    }, [currentQuestion]);

    if (error && !assignment) return <div id="content" className="error-state">{error}</div>;
    if (!assignment) return null;

    const renderQuestionInput = (q) => {
        switch (q.questionType) {
            case 'mcq':
                return (
                    <div className="mcq-grid">
                        {q.options.map((opt, i) => (
                            <div 
                                key={i} 
                                className={`mcq-opt ${answers[q._id] === opt ? 'selected' : ''}`}
                                onClick={() => handleAnswerChange(q._id, opt)}
                            >
                                <div className="opt-indicator">
                                    <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                                </div>
                                <span className="opt-text">{opt}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'true_false':
                return (
                    <div className="tf-options">
                        <div 
                            className={`tf-card true ${answers[q._id] === 'Igaz' ? 'selected' : ''}`}
                            onClick={() => handleAnswerChange(q._id, 'Igaz')}
                        >
                            <div className="tf-icon-circle"><FaCheckCircle /></div>
                            <span>Igaz</span>
                        </div>
                        <div 
                            className={`tf-card false ${answers[q._id] === 'Hamis' ? 'selected' : ''}`}
                            onClick={() => handleAnswerChange(q._id, 'Hamis')}
                        >
                            <div className="tf-icon-circle"><FaExclamationCircle /></div>
                            <span>Hamis</span>
                        </div>
                    </div>
                );
            case 'short_answer':
                return (
                    <div className="text-input-wrapper">
                        <textarea 
                            className="premium-textarea"
                            placeholder="Ide gépeld a válaszod kifejtve..."
                            value={answers[q._id] || ''}
                            onChange={(e) => handleAnswerChange(q._id, e.target.value)}
                        />
                        <div className="input-hint">Az AI értékeli a válaszod tartalmát.</div>
                    </div>
                );
            case 'fill_blank':
                return (
                    <div className="fill-blank-area">
                        <div className="blank-pill">
                            <input 
                                type="text" 
                                className="premium-input"
                                placeholder="A hiányzó szó..."
                                value={answers[q._id] || ''}
                                onChange={(e) => handleAnswerChange(q._id, e.target.value)}
                            />
                        </div>
                    </div>
                );
            case 'ordering':
                const items = answers[q._id] || [];
                const handleDragStart = (e, idx) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                };
                const handleDrop = (e, toIdx) => {
                    e.preventDefault();
                    setDragOverIdx(null);
                    const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                    if (fromIdx === toIdx) return;
                    const newArr = [...items];
                    const [removed] = newArr.splice(fromIdx, 1);
                    newArr.splice(toIdx, 0, removed);
                    handleAnswerChange(q._id, newArr);
                };
                const handleDragOver = (e, i) => { e.preventDefault(); setDragOverIdx(i); };
                const handleDragLeave = () => setDragOverIdx(null);
                return (
                    <div className="ordering-container">
                        <p className="ordering-hint">Húzd a kártyákat a megfelelő sorrendbe</p>
                        {items.map((item, i) => (
                            <div
                                key={item}
                                className={`order-card ${dragOverIdx === i ? 'drag-over' : ''}`}
                                draggable
                                onDragStart={e => handleDragStart(e, i)}
                                onDrop={e => handleDrop(e, i)}
                                onDragOver={e => handleDragOver(e, i)}
                                onDragLeave={handleDragLeave}
                            >
                                <div className="order-drag-handle">⠿</div>
                                <div className="order-index">{i + 1}</div>
                                <span className="item-text">{item}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'matching':
                const currentMatching = answers[q._id] || {};
                return (
                    <div className="matching-layout">
                        {q.pairs.map((pair, i) => (
                            <div key={i} className="matching-pair-card">
                                <div className="match-term-box">
                                    <span className="term-label">Kifejezés</span>
                                    <p className="term-text">{pair.left}</p>
                                </div>
                                <div className="match-connector">
                                    <FaArrowRight />
                                </div>
                                <div className="match-def-box">
                                    <select 
                                        className="premium-select"
                                        value={currentMatching[pair.left] || ''}
                                        onChange={(e) => {
                                            const newVal = { ...currentMatching, [pair.left]: e.target.value };
                                            handleAnswerChange(q._id, newVal);
                                        }}
                                    >
                                        <option value="">Válassz egy definíciót...</option>
                                        {shuffledMatchingRight.map((opt, oi) => {
                                            const takenByOther = Object.entries(currentMatching)
                                                .some(([key, val]) => val === opt && key !== pair.left);
                                            return (
                                                <option key={oi} value={opt} disabled={takenByOther}>
                                                    {opt}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            default:
                return <p className="unsupported-msg">Ez a kérdéstípus jelenleg nem támogatott.</p>;
        }
    };

    return (
        <div id="content">
            <div className="assignment-submit-premium">
                <header className="submit-header">
                    <div className="header-info">
                        <h1>{assignment.title}</h1>
                        <p>{assignment.subject} • {assignment.questions.length} feladat</p>
                    </div>
                    {timeLeft !== null && (
                        <div className={`timer-box ${timeLeft < 60 ? 'warning' : ''}`}>
                            <FaClock />
                            <span>{formatTime(timeLeft)}</span>
                        </div>
                    )}
                </header>

                <div className="progress-stepper">
                    {assignment.questions.map((_, i) => (
                        <div 
                            key={i} 
                            className={`step-dot ${i === currentStep ? 'active' : ''} ${isQuestionAnswered(assignment.questions[i]) ? 'filled' : ''}`}
                            onClick={() => setCurrentStep(i)}
                        ></div>
                    ))}
                </div>

                <main className="question-display">
                    <div className="q-header">
                        <span className="q-count">{currentStep + 1} / {assignment.questions.length}</span>
                        <h2 className="q-text">{currentQuestion.questionText}</h2>
                    </div>

                    <div className="q-input-area">
                        {renderQuestionInput(currentQuestion)}
                    </div>
                </main>

                <footer className="submit-footer">
                    <button 
                        className="nav-btn prev" 
                        disabled={currentStep === 0}
                        onClick={() => setCurrentStep(s => s - 1)}
                    >
                        <FaArrowLeft /> Előző
                    </button>

                    {isLastStep ? (
                        <button 
                            className="submit-btn" 
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Küldés...' : 'Dolgozat Befejezése'} <FaPaperPlane />
                        </button>
                    ) : (
                        <button 
                            className="nav-btn next" 
                            onClick={() => setCurrentStep(s => s + 1)}
                        >
                            Következő <FaArrowRight />
                        </button>
                    )}
                </footer>

                {error && <div className="submit-error"><FaExclamationCircle /> {error}</div>}
            </div>
        </div>
    );
};

export default AssignmentSubmitForm;
