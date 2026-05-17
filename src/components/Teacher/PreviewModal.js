import React, { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle, FaLayerGroup, FaArrowRight, FaSync } from 'react-icons/fa';
import '../../styles/Teacher/PreviewModal.css';

const PreviewModal = ({ questions: initialQuestions, onSave, onClose, onRegenerate, isLoading }) => {
    const [questions, setQuestions] = useState([]);

    useEffect(() => {
        setQuestions(initialQuestions.map(q => ({ ...q })));
    }, [initialQuestions]);

    const updateQuestion = (idx, field, value) =>
        setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));

    const updateOption = (qIdx, optIdx, value) =>
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const options = [...(q.options || [])];
            const previous = options[optIdx];
            options[optIdx] = value;
            return {
                ...q,
                options,
                correctAnswer: q.correctAnswer === previous ? value : q.correctAnswer
            };
        }));

    const updatePair = (qIdx, pairIdx, field, value) =>
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const pairs = [...(q.pairs || [])];
            pairs[pairIdx] = { ...pairs[pairIdx], [field]: value };
            return {
                ...q,
                pairs,
                options: pairs.map(p => p.right).filter(Boolean),
                correctAnswer: Object.fromEntries(pairs.filter(p => p.left && p.right).map(p => [p.left, p.right]))
            };
        }));

    const updateOrderingAnswer = (qIdx, lineText) => {
        const correctAnswer = lineText.split('\n').map(item => item.trim()).filter(Boolean);
        updateQuestion(qIdx, 'correctAnswer', correctAnswer);
    };

    const getTypeName = (type) => {
        const types = {
            'mcq': 'Feleletválasztós',
            'short_answer': 'Nyílt végű',
            'true_false': 'Igaz/Hamis',
            'fill_blank': 'Hiányos szöveg',
            'matching': 'Párosítás',
            'ordering': 'Sorrend'
        };
        return types[type] || 'Egyéb';
    };

    return (
        <div className="preview-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="preview-modal">
                <header className="preview-header">
                    <div className="header-info">
                        <div className="header-icon"><FaLayerGroup /></div>
                        <div>
                            <h2>Dolgozat Előnézet</h2>
                            <p>{questions.length} generált feladat ellenőrzése</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}><FaTimes /></button>
                </header>

                <div className="preview-content">
                    {questions.map((q, idx) => (
                        <div key={idx} className="preview-card">
                            <div className="card-top">
                                <div className="q-badge">{idx + 1}. Feladat</div>
                                <div className="q-type-badge">{getTypeName(q.questionType)}</div>
                                <div className="q-points-input">
                                    <input
                                        type="number"
                                        min="1"
                                        value={q.points || 1}
                                        onChange={(e) => updateQuestion(idx, 'points', parseInt(e.target.value) || 1)}
                                    />
                                    <span>pont</span>
                                </div>
                            </div>

                            <div className="q-body">
                                <label>Kérdés szövege</label>
                                <textarea
                                    value={q.questionText}
                                    onChange={(e) => updateQuestion(idx, 'questionText', e.target.value)}
                                    placeholder="Kérdés szövege..."
                                />

                                <div className="q-answer-section">
                                    {q.questionType === 'mcq' && (
                                        <div className="options-grid">
                                            {(q.options || []).map((opt, i) => (
                                                <div key={i} className={`opt-item ${opt === q.correctAnswer ? 'correct' : ''}`}>
                                                    <span className="opt-marker">{String.fromCharCode(65 + i)}</span>
                                                    <input
                                                        type="text"
                                                        value={opt}
                                                        onChange={(e) => updateOption(idx, i, e.target.value)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="mark-correct-btn"
                                                        onClick={() => updateQuestion(idx, 'correctAnswer', opt)}
                                                    >
                                                        {opt === q.correctAnswer ? 'Helyes' : 'Helyes válasz'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {q.questionType === 'true_false' && (
                                        <div className="tf-preview">
                                            <label>Helyes válasz:</label>
                                            <select
                                                value={q.correctAnswer || 'Igaz'}
                                                onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                                            >
                                                <option value="Igaz">Igaz</option>
                                                <option value="Hamis">Hamis</option>
                                            </select>
                                        </div>
                                    )}

                                    {q.questionType === 'short_answer' && (
                                        <div className="open-answer-preview">
                                            <label>Helyes válasz / Kulcsszavak:</label>
                                            <input 
                                                type="text" 
                                                value={q.correctAnswer} 
                                                onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {q.questionType === 'fill_blank' && (
                                        <div className="fill-blank-preview">
                                            <label>Hiányzó szó / megoldás:</label>
                                            <input
                                                type="text"
                                                value={q.correctAnswer || ''}
                                                onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                                            />
                                        </div>
                                    )}

                                    {q.questionType === 'matching' && (
                                        <div className="matching-preview">
                                            {(q.pairs || []).map((pair, i) => (
                                                <div key={i} className="match-pair">
                                                    <input
                                                        type="text"
                                                        value={pair.left || ''}
                                                        onChange={(e) => updatePair(idx, i, 'left', e.target.value)}
                                                    />
                                                    <FaArrowRight />
                                                    <input
                                                        type="text"
                                                        value={pair.right || ''}
                                                        onChange={(e) => updatePair(idx, i, 'right', e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {q.questionType === 'ordering' && (
                                        <div className="ordering-preview">
                                            {(Array.isArray(q.correctAnswer) ? q.correctAnswer : Array.isArray(q.items) ? q.items : []).map((item, i) => (
                                                <div key={i} className="order-item">
                                                    <span className="order-num">{i + 1}</span>
                                                    {item}
                                                </div>
                                            ))}
                                            <label>Helyes sorrend (soronként egy elem):</label>
                                            <textarea
                                                value={(Array.isArray(q.correctAnswer) ? q.correctAnswer : []).join('\n')}
                                                onChange={(e) => updateOrderingAnswer(idx, e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <footer className="preview-footer">
                    <button className="secondary-btn" onClick={onClose} disabled={isLoading}>
                        Mégsem
                    </button>
                    {onRegenerate && (
                        <button className="regen-btn" onClick={onRegenerate} disabled={isLoading}>
                            <FaSync className={isLoading ? 'spin' : ''} /> {isLoading ? 'Generálás...' : 'Újragenerálás'}
                        </button>
                    )}
                    <button className="primary-btn" onClick={() => onSave(questions)} disabled={isLoading}>
                        {isLoading ? 'Feldolgozás...' : 'Dolgozat Létrehozása'}
                        <FaCheckCircle className="btn-icon" />
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default PreviewModal;
