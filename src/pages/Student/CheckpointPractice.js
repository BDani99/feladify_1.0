import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaPaperPlane, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import '../../styles/Student/CheckpointPractice.css';

const API_BASE = '/api/student/checkpoint';
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`
});

const CheckpointPractice = () => {
  const { subject, checkpointId } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [checkpointTitle, setCheckpointTitle] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [mentorInput, setMentorInput] = useState('');
  const [mentorLoading, setMentorLoading] = useState(false);
  const [answeredCorrectly, setAnsweredCorrectly] = useState({});
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [scoreError, setScoreError] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => { startCheckpoint(); }, [subject, checkpointId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const startCheckpoint = async () => {
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ subject, checkpointId })
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setCheckpointTitle(data.checkpointTitle || '');
        setScore({ correct: 0, total: data.questions?.length || 0 });
        addBotMessage(`Üdvözöllek a **"${data.checkpointTitle}"** fejezetben! ${data.questions?.length || 0} feladat vár rád. Legalább 80% kell a teljesítéshez. Sok sikert! 🎯`);
      } else {
        addBotMessage('Hiba a checkpoint betöltésekor. Kérlek, próbálj vissza navigálni.');
      }
    } catch (err) {
      console.error('Hiba a checkpoint indításakor:', err);
    } finally {
      setLoading(false);
    }
  };

  const addBotMessage = (content) => {
    setChatMessages(prev => [...prev, { role: 'bot', content, timestamp: new Date() }]);
  };

  const addUserMessage = (content) => {
    setChatMessages(prev => [...prev, { role: 'user', content, timestamp: new Date() }]);
  };

  const handleAnswerChange = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleOrderingDrop = (questionId, items, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const current = [...(answers[questionId] || items)];
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    setAnswers(prev => ({ ...prev, [questionId]: current }));
    setDragOverIdx(null);
  };

  const collectAnswer = (question) => {
    const qid = question.questionId;
    if (question.questionType === 'matching') {
      const result = {};
      (question.pairs || []).forEach((pair, idx) => {
        const val = answers[`${qid}-${idx}`];
        if (val) result[pair.left] = val;
      });
      return Object.keys(result).length === (question.pairs || []).length ? result : null;
    }
    if (question.questionType === 'ordering') {
      return answers[qid] || [...(question.items || [])];
    }
    const val = answers[qid];
    return val !== undefined && val !== '' ? val : null;
  };

  const isAnswered = (question) => {
    const qid = question.questionId;
    if (question.questionType === 'matching') {
      return (question.pairs || []).every((_, idx) => answers[`${qid}-${idx}`]);
    }
    if (question.questionType === 'ordering') return true;
    return answers[qid] !== undefined && answers[qid] !== '';
  };

  const handleCheckAnswer = async () => {
    const question = questions[currentIndex];
    const answer = collectAnswer(question);
    if (answer === null || isChecking) return;

    setIsChecking(true);
    try {
      const res = await fetch(`${API_BASE}/answer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ checkpointId, questionId: question.questionId, answer, subject })
      });
      if (res.ok) {
        const data = await res.json();
        setScore({ correct: data.currentScore.correct, total: data.currentScore.total });

        if (data.isCorrect) {
          setAnsweredCorrectly(prev => ({ ...prev, [question.questionId]: true }));
          setQuestionStatuses(prev => ({ ...prev, [question.questionId]: 'correct' }));
          addBotMessage(`✅ ${data.aiMessage}`);
        } else {
          setQuestionStatuses(prev => ({ ...prev, [question.questionId]: 'incorrect' }));
          const hintText = data.hint ? `\n\n💡 *${data.hint}*` : '';
          addBotMessage(`❌ ${data.aiMessage}${hintText}\n\nPróbáld meg újra! 💪`);
        }
      }
    } catch (err) {
      console.error('Hiba a válasz ellenőrzésekor:', err);
      addBotMessage('⚠️ Hiba az ellenőrzéskor. Próbáld újra!');
    } finally {
      setIsChecking(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setScoreError(null);
    } else {
      completeCheckpoint();
    }
  };

  const completeCheckpoint = async () => {
    setScoreError(null);
    setCompleting(true);
    try {
      const res = await fetch(`${API_BASE}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ checkpointId, subject })
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/egyeni-gyakorlas/${subject}/roadmap`, {
          state: {
            completedCheckpoint: checkpointId,
            xpEarned: data.xpEarned,
            score: data.score,
            newBadges: data.newBadges
          }
        });
      } else {
        const err = await res.json();
        setScoreError(err.message || 'Legalább 80% szükséges a teljesítéshez!');
        addBotMessage(`⚠️ ${err.message || 'Legalább 80% szükséges!'} Jelenlegi eredmény: **${err.score ?? score.correct}/${score.total}**. Menj vissza és javítsd ki a hibás válaszokat! 💪`);
      }
    } catch (err) {
      console.error('Hiba a fejezet lezárásakor:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleMentorChat = async (e) => {
    e.preventDefault();
    if (!mentorInput.trim() || mentorLoading) return;

    const userMsg = mentorInput.trim();
    addUserMessage(userMsg);
    setMentorInput('');
    setMentorLoading(true);

    const question = questions[currentIndex];
    const answer = collectAnswer(question);
    const updatedHistory = [...chatMessages, { role: 'user', content: userMsg }];

    try {
      const attempts = chatMessages.filter(m => m.role === 'user').length + 1;
      const res = await fetch(`${API_BASE}/hint`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          checkpointId,
          questionId: question.questionId,
          studentAnswer: answer || userMsg,
          attemptNumber: attempts,
          chatHistory: updatedHistory
        })
      });
      if (res.ok) {
        const data = await res.json();
        addBotMessage(data.hint || 'Próbáld meg más megközelítésből!');
      }
    } catch (err) {
      addBotMessage('Hiba történt. Próbáld újra!');
    } finally {
      setMentorLoading(false);
    }
  };

  if (loading) return <div id="content"><LoadingSpinner /></div>;

  if (!questions || questions.length === 0) {
    return (
      <div id="content">
        <div className="checkpoint-practice">
          <div className="page-top-bar">
            <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}/roadmap`)}>
              <FaArrowLeft /> Vissza
            </button>
          </div>
          <p style={{ textAlign: 'center', marginTop: '40px' }}>Nem sikerült betölteni a feladatokat. Próbálj vissza navigálni.</p>
        </div>
      </div>
    );
  }

  const question = questions[currentIndex];
  const qid = question.questionId;
  const progressPct = ((currentIndex + 1) / questions.length) * 100;
  const answered = isAnswered(question);
  const currentItems = answers[qid] || question.items || [];
  const isCurrentCorrect = answeredCorrectly[qid];
  const scorePct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div id="content">
      <div className="checkpoint-practice">
        <div className="page-top-bar">
          <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}/roadmap`)}>
            <FaArrowLeft /> Vissza a térképre
          </button>
        </div>

        <div className="practice-wrapper">
          {/* Bal oldal – Feladat */}
          <div className="practice-left">
            <div className="question-header">
              <div className="question-meta">
                <span className="question-count">{currentIndex + 1} / {questions.length}</span>
                <span className="score-display">✓ {score.correct}/{score.total}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>

              {/* Kérdésnavigátor */}
              <div className="question-navigator">
                {questions.map((q, idx) => {
                  const status = questionStatuses[q.questionId];
                  return (
                    <button
                      key={q.questionId}
                      className={`question-dot ${idx === currentIndex ? 'active' : ''} ${status || ''}`}
                      onClick={() => { if (!isChecking) { setCurrentIndex(idx); setScoreError(null); } }}
                      disabled={isChecking}
                      title={`Kérdés ${idx + 1}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="question-card">
              <h3>{question.questionText}</h3>

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
                        disabled={isCurrentCorrect || isChecking}
                      />
                      <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Igaz / Hamis */}
              {question.questionType === 'true_false' && (
                <div className="true-false-btns">
                  {['Igaz', 'Hamis'].map(val => (
                    <button
                      key={val}
                      className={`tf-btn ${answers[qid] === val ? 'selected' : ''}`}
                      onClick={() => handleAnswerChange(qid, val)}
                      disabled={isCurrentCorrect || isChecking}
                    >
                      {val === 'Igaz' ? '✓ Igaz' : '✗ Hamis'}
                    </button>
                  ))}
                </div>
              )}

              {/* Rövid válasz */}
              {question.questionType === 'short_answer' && (
                <textarea
                  className="answer-input"
                  placeholder="Írd le a válaszod..."
                  value={answers[qid] || ''}
                  onChange={e => handleAnswerChange(qid, e.target.value)}
                  rows={4}
                  disabled={isCurrentCorrect || isChecking}
                />
              )}

              {/* Szövegkiegészítés */}
              {question.questionType === 'fill_blank' && (
                <input
                  type="text"
                  className="answer-input"
                  placeholder="Hiányzó szó vagy kifejezés..."
                  value={answers[qid] || ''}
                  onChange={e => handleAnswerChange(qid, e.target.value)}
                  disabled={isCurrentCorrect || isChecking}
                />
              )}

              {/* Párosítás */}
              {question.questionType === 'matching' && (
                <div className="matching">
                  {(question.pairs || []).map((pair, idx) => (
                    <div key={idx} className="match-row">
                      <span className="match-left">{pair.left}</span>
                      <select
                        className="match-select"
                        value={answers[`${qid}-${idx}`] || ''}
                        onChange={e => handleAnswerChange(`${qid}-${idx}`, e.target.value)}
                        disabled={isCurrentCorrect || isChecking}
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
                  <p className="ordering-hint">Húzd a kívánt sorrendbe:</p>
                  {currentItems.map((item, idx) => (
                    <div
                      key={`${qid}-${idx}`}
                      className={`order-item ${dragIdx === idx ? 'dragging' : ''} ${dragOverIdx === idx && dragIdx !== idx ? 'drag-over' : ''}`}
                      draggable={!isCurrentCorrect && !isChecking}
                      onDragStart={() => { if (!isCurrentCorrect && !isChecking) setDragIdx(idx); }}
                      onDragOver={(e) => { e.preventDefault(); if (dragIdx !== idx) setDragOverIdx(idx); }}
                      onDrop={() => {
                        if (!isCurrentCorrect && !isChecking) handleOrderingDrop(qid, question.items, dragIdx, idx);
                        setDragIdx(null);
                        setDragOverIdx(null);
                      }}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    >
                      <span className="drag-handle">⠿</span>
                      <span className="order-num">{idx + 1}.</span>
                      <span className="order-text">{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 80% hibaüzenet */}
              {scoreError && (
                <div className="score-error-msg">
                  ⚠️ {scoreError}
                </div>
              )}

              {/* Gombok */}
              <div className="action-buttons">
                {isCurrentCorrect ? (
                  <button
                    className="next-btn"
                    onClick={handleNextQuestion}
                    disabled={completing}
                  >
                    {completing
                      ? 'Mentés...'
                      : isLastQuestion
                        ? (scorePct >= 80 ? '🏁 Fejezet befejezése' : `⚠️ Befejezés (${scorePct}% – min. 80% kell)`)
                        : 'Következő kérdés →'}
                  </button>
                ) : (
                  <button
                    className={`check-btn ${isChecking ? 'checking' : ''}`}
                    onClick={handleCheckAnswer}
                    disabled={!answered || isChecking}
                  >
                    {isChecking ? 'Ellenőrzés...' : 'Ellenőrzés'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Jobb oldal – AI Mentor chat */}
          <div className={`practice-right ${isChatOpen ? 'open' : 'closed'}`}>
            <div className="chat-header" onClick={() => setIsChatOpen(!isChatOpen)} style={{ cursor: 'pointer' }}>
              <h4>🤖 AI Tanár</h4>
              <button className="chat-toggle" aria-label="Csevegő megnyitása/zárása">
                {isChatOpen ? <FaChevronDown /> : <FaChevronUp />}
              </button>
            </div>

            {isChatOpen && (
              <>
                <div className="chat-messages">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-msg ${msg.role}`}>
                      <div className="msg-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {mentorLoading && (
                    <div className="chat-msg bot">
                      <div className="typing-dots"><span /><span /><span /></div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form className="chat-form" onSubmit={handleMentorChat}>
                  <input
                    type="text"
                    placeholder="Kérdezd az AI tanárt..."
                    value={mentorInput}
                    onChange={e => setMentorInput(e.target.value)}
                    disabled={mentorLoading}
                  />
                  <button type="submit" disabled={mentorLoading || !mentorInput.trim()}>
                    <FaPaperPlane />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckpointPractice;
