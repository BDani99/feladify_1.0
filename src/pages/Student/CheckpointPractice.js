import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaPaperPlane, FaChevronUp, FaChevronDown, FaCheck, FaTimes } from 'react-icons/fa';
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
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [completing, setCompleting] = useState(false);
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
        addBotMessage(`Üdvözöllek a **"${data.checkpointTitle}"** fejezetben! ${data.questions?.length || 0} feladat vár rád, legalább 6 különböző típusban. Sok sikert! 🎯`);
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

  // Egységes answer kezelő - kulcs: questionId vagy questionId-idx (matching)
  const handleAnswerChange = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    setFeedback(null);
  };

  // Ordering: elemek sorrendjének változtatása fel/le gombokkal
  const handleOrderingMove = (questionId, items, fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= items.length) return;
    const currentOrder = answers[questionId] || [...items];
    const newOrder = [...currentOrder];
    [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
    setAnswers(prev => ({ ...prev, [questionId]: newOrder }));
    setFeedback(null);
  };

  // Összegyűjti a jelenlegi kérdés válaszát küldéshez
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
      const order = answers[qid] || [...(question.items || [])];
      return order;
    }
    const val = answers[qid];
    return val !== undefined && val !== '' ? val : null;
  };

  const isAnswered = (question) => {
    const qid = question.questionId;
    if (question.questionType === 'matching') {
      return (question.pairs || []).every((_, idx) => answers[`${qid}-${idx}`]);
    }
    if (question.questionType === 'ordering') {
      return true; // mindig van sorrend (alapértelmezett)
    }
    return answers[qid] !== undefined && answers[qid] !== '';
  };

  const handleCheckAnswer = async () => {
    const question = questions[currentIndex];
    const answer = collectAnswer(question);
    if (answer === null) return;

    setFeedback({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/answer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ checkpointId, questionId: question.questionId, answer, subject })
      });
      if (res.ok) {
        const data = await res.json();
        setFeedback({ isCorrect: data.isCorrect, message: data.aiMessage, hint: data.hint });
        setScore({ correct: data.currentScore.correct, total: data.currentScore.total });
        addBotMessage(data.isCorrect
          ? `✅ ${data.aiMessage}`
          : `❌ ${data.aiMessage}${data.hint ? `\n\n💡 *${data.hint}*` : ''}`
        );
      }
    } catch (err) {
      console.error('Hiba a válasz ellenőrzésekor:', err);
      setFeedback({ error: true, message: 'Hiba történt az ellenőrzés során.' });
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setFeedback(null);
    } else {
      completeCheckpoint();
    }
  };

  const completeCheckpoint = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`${API_BASE}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ checkpointId, subject })
      });
      if (res.ok) {
        const data = await res.json();
        setTotalXpEarned(data.xpEarned || 0);
        navigate(`/egyeni-gyakorlas/${subject}/roadmap`, {
          state: {
            completedCheckpoint: checkpointId,
            xpEarned: data.xpEarned,
            score: data.score,
            newBadges: data.newBadges
          }
        });
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

    try {
      const attempts = chatMessages.filter(m => m.role === 'user').length + 1;
      const res = await fetch(`${API_BASE}/hint`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          checkpointId,
          questionId: question.questionId,
          studentAnswer: answer || userMsg,
          attemptNumber: attempts
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
      <div id="content" className="checkpoint-practice">
        <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}/roadmap`)}>
          <FaArrowLeft /> Vissza
        </button>
        <p style={{ textAlign: 'center', marginTop: '40px' }}>Nem sikerült betölteni a feladatokat. Próbálj vissza navigálni.</p>
      </div>
    );
  }

  const question = questions[currentIndex];
  const qid = question.questionId;
  const progressPct = ((currentIndex + 1) / questions.length) * 100;
  const answered = isAnswered(question);

  return (
    <div id="content" className="checkpoint-practice">
      <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}/roadmap`)}>
        <FaArrowLeft /> Vissza a térképre
      </button>

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
                      disabled={!!feedback}
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
                    disabled={!!feedback}
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
                disabled={!!feedback}
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
                disabled={!!feedback}
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
                      disabled={!!feedback}
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

            {/* Sorba rendezés */}
            {question.questionType === 'ordering' && (
              <div className="ordering">
                <p className="ordering-hint">Rendezd a helyes sorrendbe (fel/le nyilakkal):</p>
                {(answers[qid] || question.items || []).map((item, idx) => (
                  <div key={idx} className="order-item">
                    <span className="order-num">{idx + 1}.</span>
                    <span className="order-text">{item}</span>
                    <div className="order-controls">
                      <button
                        onClick={() => handleOrderingMove(qid, answers[qid] || question.items, idx, idx - 1)}
                        disabled={idx === 0 || !!feedback}
                        title="Feljebb"
                      >▲</button>
                      <button
                        onClick={() => handleOrderingMove(qid, answers[qid] || question.items, idx, idx + 1)}
                        disabled={idx === (answers[qid] || question.items || []).length - 1 || !!feedback}
                        title="Lejjebb"
                      >▼</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visszajelzés */}
            {feedback && (
              <div className={`feedback ${feedback.loading ? 'loading' : feedback.isCorrect ? 'correct' : feedback.error ? 'error' : 'incorrect'}`}>
                {feedback.loading ? (
                  <p>Ellenőrzés...</p>
                ) : (
                  <>
                    <span className="feedback-icon">{feedback.isCorrect ? <FaCheck /> : <FaTimes />}</span>
                    <p>{feedback.message}</p>
                    {feedback.hint && <p className="hint">💡 {feedback.hint}</p>}
                  </>
                )}
              </div>
            )}

            {/* Gombok */}
            <div className="action-buttons">
              {!feedback ? (
                <button
                  className="check-btn"
                  onClick={handleCheckAnswer}
                  disabled={!answered}
                >
                  Ellenőrzés
                </button>
              ) : (
                <button
                  className="next-btn"
                  onClick={handleNextQuestion}
                  disabled={completing}
                >
                  {completing
                    ? 'Mentés...'
                    : currentIndex === questions.length - 1
                      ? '🏁 Fejezet befejezése'
                      : 'Következő kérdés →'}
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
  );
};

export default CheckpointPractice;
