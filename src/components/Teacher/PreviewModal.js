import React, { useState, useEffect } from 'react';
import '../../styles/Teacher/PreviewModal.css';

const PreviewModal = ({ questions: initialQuestions, onSave, onClose, isLoading }) => {
    const [questions, setQuestions] = useState([]);

    useEffect(() => {
        setQuestions(initialQuestions.map(q => ({ ...q })));
    }, [initialQuestions]);

    const updateQuestion = (idx, field, value) =>
        setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));

    return (
        <div className="preview-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="preview-modal">
                <div className="preview-modal-header">
                    <h2>Generált dolgozat előnézete ({questions.length} kérdés)</h2>
                    <button className="preview-modal-close" onClick={onClose} aria-label="Bezárás">×</button>
                </div>

                <div className="preview-questions-list">
                    {questions.map((question, idx) => {
                        const isMC = Array.isArray(question.options) && question.options.length > 0;
                        return (
                            <div key={idx} className="preview-question-item">
                                <div className="pq-label">
                                    {idx + 1}. kérdés – {isMC ? 'Feleletválasztós' : 'Nyílt végű'}
                                </div>
                                <textarea
                                    value={question.questionText}
                                    onChange={(e) => updateQuestion(idx, 'questionText', e.target.value)}
                                    rows={2}
                                />
                                {isMC ? (
                                    <div className="pq-options">
                                        {question.options.map((opt, oi) => (
                                            <p key={oi}>{opt}</p>
                                        ))}
                                        <p className="pq-correct">Helyes válasz: {question.correctAnswer}</p>
                                    </div>
                                ) : (
                                    <div className="pq-open-answer">
                                        <label>Elvárt válasz (javítási alap):</label>
                                        <input
                                            type="text"
                                            value={question.correctAnswer || ''}
                                            onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                                        />
                                    </div>
                                )}
                                <div className="pq-points">
                                    <label>Pont:</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={question.points || 1}
                                        onChange={(e) => updateQuestion(idx, 'points', Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="preview-modal-footer">
                    <button className="btn-preview-cancel" onClick={onClose} disabled={isLoading}>
                        Mégsem
                    </button>
                    <button
                        className="btn-preview-save"
                        onClick={() => onSave(questions)}
                        disabled={isLoading || questions.length === 0}
                    >
                        {isLoading ? 'Mentés...' : 'Mentés és Létrehozás'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreviewModal;
