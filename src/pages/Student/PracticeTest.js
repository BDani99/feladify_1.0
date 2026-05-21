import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../api/config';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaArrowRight, FaCheck } from 'react-icons/fa';
import '../../styles/Student/PracticeTest.css';

const PracticeTest = () => {
  const { subject } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testId, setTestId] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [generationComplete, setGenerationComplete] = useState(false);
  const firstBatchShownRef = useRef(false);

  useEffect(() => {
    const { testId: stateTestId, questions: stateQuestions } = location.state || {};
    if (stateTestId && stateQuestions?.length > 0) {
      setTestId(stateTestId);
      setQuestions(stateQuestions);
      setGenerationComplete(true);
      setLoading(false);
    } else if (stateTestId) {
      setTestId(stateTestId);
      startNewTest();
    } else {
      startNewTest();
    }
  }, [subject]);

  const startNewTest = async () => {
    let asyncGeneration = false;
    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/student/diagnostic/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade: user?.className || '4. osztály' })
      });
      if (response.ok) {
        const data = await response.json();
        setTestId(data.testId);
        if (data.questions?.length > 0) {
          setQuestions(data.questions);
          setGenerationComplete(true);
        } else if (data.sessionId) {
          asyncGeneration = true;
          firstBatchShownRef.current = false;
          setSessionId(data.sessionId);
          // Stay in loading state until first batch arrives
        }
      } else {
        const err = await response.json();
        alert(`Hiba: ${err.message}`);
      }
    } catch (err) {
      console.error('Hiba a teszt indításakor:', err);
      alert('Hiba a teszt indításakor.');
    } finally {
      if (!asyncGeneration) setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId || generationComplete) return;
    firstBatchShownRef.current = false;
    const token = localStorage.getItem('AccessToken');
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/student/diagnostic/poll/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.error) {
          clearInterval(interval);
          alert(`Hiba a kérdések generálásakor: ${data.error}`);
          return;
        }
        if (data.questions?.length > 0) {
          if (!firstBatchShownRef.current) {
            firstBatchShownRef.current = true;
            const total = data.totalQuestions || 10;
            setQuestions(Array.from({ length: total }, (_, i) =>
              data.questions[i] || { questionId: `placeholder_${i}`, isLoading: true }
            ));
            setLoading(false);
          } else {
            setQuestions(prev => prev.map((q, i) => data.questions[i] || q));
          }
        }
        if (data.complete) {
          setGenerationComplete(true);
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId, generationComplete]);

  const handleAnswerChange = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleOrderingDrop = (qid, items, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const current = [...(answers[qid] || items)];
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    setAnswers(prev => ({ ...prev, [qid]: current }));
  };

  const isAnswered = (question) => {
    if (!question || question.isLoading) return false;
    const qid = question.questionId;
    if (question.questionType === 'matching') {
      return (question.pairs || []).every((_, idx) => answers[`${qid}-${idx}`]);
    }
    if (question.questionType === 'ordering') return !!answers[qid];
    if (question.questionType === 'fill_blank') {
      const blankCount = (question.questionText.match(/___/g) || []).length || 1;
      return Array.from({ length: blankCount }, (_, i) => answers[`${qid}_b${i}`]).every(v => v && v !== '');
    }
    return answers[qid] !== undefined && answers[qid] !== '';
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleSubmit = async () => {
    if (!generationComplete && questions.some(q => q.isLoading)) {
      alert('Néhány kérdés még generálódik. Kérjük, várj néhány másodpercet!');
      return;
    }
    setSubmitting(true);
    try {
      const finalAnswers = { ...answers };
      questions.forEach(q => {
        if (q.questionType === 'matching') {
          const qid = q.questionId;
          const matchObj = {};
          (q.pairs || []).forEach((pair, idx) => {
            const val = answers[`${qid}-${idx}`];
            if (val) matchObj[pair.left] = val;
          });
          finalAnswers[qid] = matchObj;
          (q.pairs || []).forEach((_, idx) => delete finalAnswers[`${qid}-${idx}`]);
        }
        if (q.questionType === 'ordering' && !finalAnswers[q.questionId]) {
          finalAnswers[q.questionId] = [...(q.items || [])];
        }
        if (q.questionType === 'fill_blank') {
          const blankCount = (q.questionText.match(/___/g) || []).length || 1;
          const blanks = Array.from({ length: blankCount }, (_, i) => answers[`${q.questionId}_b${i}`] || '');
          finalAnswers[q.questionId] = blanks.join('|');
          for (let i = 0; i < blankCount; i++) delete finalAnswers[`${q.questionId}_b${i}`];
        }
      });

      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/student/diagnostic/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, subject, answers: finalAnswers })
      });
      if (response.ok) {
        const data = await response.json();
        navigate(`/egyeni-gyakorlas/${subject}/eredmeny`, {
          state: {
            justCompleted: true,
            score: data.score,
            categoryAnalysis: data.categoryAnalysis,
            aiAnalysis: data.aiAnalysis,
            analyzing: data.analyzing || false,
            resultId: String(data.resultId),
            perQuestionResults: data.perQuestionResults || []
          }
        });
      } else {
        const err = await response.json();
        alert(`Hiba a beküldéskor: ${err.message}`);
      }
    } catch (err) {
      console.error('Hiba a beküldéskor:', err);
      alert('Hiba a beküldéskor.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div id="content">
        <div className="practice-test">
          <div className="page-top-bar">
            <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}`)}>
              <FaArrowLeft /> Vissza
            </button>
          </div>
          <div className="test-header">
            <h1>{subject} Szintfelmérő</h1>
          </div>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div id="content">
        <div className="practice-test">
          <p>Hiba: Nem sikerült a kérdéseket betölteni.</p>
          <button className="back-btn" onClick={() => navigate('/egyeni-gyakorlas')}>
            <FaArrowLeft /> Vissza
          </button>

        </div>
      </div>
    );
  }

  const question = questions[currentIndex];
  const answered = isAnswered(question);
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = questions.filter(q => isAnswered(q)).length;
  const qid = question.isLoading ? null : question.questionId;
  const currentItems = question.isLoading ? [] : (answers[qid] || question.items || []);

  return (
    <div id="content">
      <div className="practice-test">
        <div className="page-top-bar">
          <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}`)}>
            <FaArrowLeft /> Vissza
          </button>
        </div>

        <div className="test-header">
          <h1>{subject} Szintfelmérő</h1>
          <div className="progress-info">{currentIndex + 1} / {questions.length}</div>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="question-navigator">
          {questions.map((q, idx) => (
            <button
              key={q.questionId}
              className={`question-dot ${idx === currentIndex ? 'active' : ''} ${isAnswered(q) ? 'answered' : ''} ${q.isLoading ? 'loading' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              title={`Kérdés ${idx + 1}`}
            />
          ))}
        </div>

        <div className="question-container">
          {question.isLoading ? (
            <div className="question-loading-state">
              <div className="loading-dots">
                <span></span><span></span><span></span>
              </div>
              <p>Ez a kérdés még generálódik...</p>
            </div>
          ) : (
            <>
              <div className="question-category">{question.category}</div>
              {question.questionType === 'fill_blank' ? (
                <h2>
                  {question.questionText.split('___').map((part, idx, arr) => (
                    <React.Fragment key={idx}>
                      {part}
                      {idx < arr.length - 1 && <span className="fill-blank-marker">[{idx + 1}]</span>}
                    </React.Fragment>
                  ))}
                </h2>
              ) : (
                <h2>{question.questionText}</h2>
              )}

              <div className="question-content">
                {/* MCQ */}
                {question.questionType === 'mcq' && (
                  <div className="options">
                    {(question.options || []).map((opt, idx) => (
                      <label key={idx} className={`option ${answers[qid] === opt ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name={`q-${qid}`}
                          value={opt}
                          checked={answers[qid] === opt}
                          onChange={() => handleAnswerChange(qid, opt)}
                        />
                        <span className="option-text">{String.fromCharCode(65 + idx)}. {opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Igaz/Hamis */}
                {question.questionType === 'true_false' && (
                  <div className="true-false-btns">
                    {['Igaz', 'Hamis'].map(val => (
                      <button
                        key={val}
                        className={`tf-btn ${answers[qid] === val ? 'selected' : ''}`}
                        onClick={() => handleAnswerChange(qid, val)}
                      >
                        {val === 'Igaz' ? '✓ Igaz' : '✗ Hamis'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Rövid válasz */}
                {question.questionType === 'short_answer' && (
                  <textarea
                    className="short-answer-input"
                    placeholder="Válaszod ide..."
                    value={answers[qid] || ''}
                    onChange={e => handleAnswerChange(qid, e.target.value)}
                    rows={4}
                  />
                )}

                {/* Szövegkiegészítés */}
                {question.questionType === 'fill_blank' && (() => {
                  const blankCount = (question.questionText.match(/___/g) || []).length || 1;
                  return (
                    <div className="fill-blank-fields">
                      {Array.from({ length: blankCount }, (_, i) => (
                        <div key={i} className="fill-blank-row">
                          {blankCount > 1 && <span className="fill-blank-num">[{i + 1}]</span>}
                          <input
                            type="text"
                            className="fill-blank-input"
                            placeholder={blankCount > 1 ? `${i + 1}. hiányzó szó...` : 'Írd be a hiányzó szót...'}
                            value={answers[`${qid}_b${i}`] || ''}
                            onChange={e => handleAnswerChange(`${qid}_b${i}`, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Párosítás */}
                {question.questionType === 'matching' && (
                  <div className="matching">
                    {(question.pairs || []).map((pair, idx) => (
                      <div key={idx} className="matching-row">
                        <span className="left-item">{pair.left}</span>
                        <select
                          className="match-select"
                          value={answers[`${qid}-${idx}`] || ''}
                          onChange={e => handleAnswerChange(`${qid}-${idx}`, e.target.value)}
                        >
                          <option value="">Válassz...</option>
                          {(question.options || question.pairs.map(p => p.right)).map((opt, oi) => (
                            <option key={oi} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sorba rendezés – drag & drop */}
                {question.questionType === 'ordering' && (
                  <div className="ordering">
                    <p className="ordering-instruction">Húzd a kívánt sorrendbe:</p>
                    {currentItems.map((item, idx) => (
                      <div
                        key={`${qid}-${item}`}
                        className={`order-item ${dragIdx === idx ? 'dragging' : ''} ${dragOverIdx === idx && dragIdx !== idx ? 'drag-over' : ''}`}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragOver={(e) => { e.preventDefault(); if (dragIdx !== idx) setDragOverIdx(idx); }}
                        onDrop={() => {
                          handleOrderingDrop(qid, question.items, dragIdx, idx);
                          setDragIdx(null);
                          setDragOverIdx(null);
                        }}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      >
                        <span className="drag-handle">☰</span>
                        <span className="order-num">{idx + 1}</span>
                        <span className="order-text">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="nav-buttons">
            <button className="nav-btn prev" onClick={handlePrev} disabled={currentIndex === 0}>
              <FaArrowLeft /> Előző
            </button>

            {currentIndex === questions.length - 1 ? (
              <button
                className="nav-btn submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Beküldés...' : <><FaCheck /> Beküldés ({answeredCount}/{questions.length})</>}
              </button>
            ) : (
              <button className="nav-btn next" onClick={handleNext}>
                Következő <FaArrowRight />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeTest;
