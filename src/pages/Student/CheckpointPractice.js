import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaPaperPlane, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import '../../styles/Student/CheckpointPractice.css';

const CheckpointPractice = () => {
  const { subject, checkpointId } = useParams();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [mentorInput, setMentorInput] = useState('');
  const [mentorLoading, setMentorLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    startCheckpoint();
  }, [subject, checkpointId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startCheckpoint = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch('/api/student/checkpoint/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject, checkpointId })
      });
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
        setChatMessages([{
          role: 'bot',
          content: `Üdvözöllek a "${data.checkpointTitle}" fejezetben! ${data.questions ? data.questions.length : '0'} kérdést kell megoldanod. Sok sikerert! 🎯`
        }]);
      }
    } catch (err) {
      console.error('Hiba a checkpoint indításakor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
    setFeedback(null);
  };

  const handleCheckAnswer = async () => {
    const question = questions[currentIndex];
    const userAnswer = answers[question._id];
    if (!userAnswer) return;

    setFeedback({ loading: true });
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch('/api/student/checkpoint/answer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkpointId,
          questionId: question._id,
          answer: userAnswer,
          subject
        })
      });
      if (response.ok) {
        const data = await response.json();
        setFeedback({
          isCorrect: data.isCorrect,
          message: data.aiMessage,
          hint: data.hint,
          xpEarned: data.currentScore?.xpEarned || 0
        });
        if (data.isCorrect) {
          setXpEarned(prev => prev + (data.currentScore?.xpEarned || 0));
        }
        addChatMessage('bot', data.aiMessage);
      }
    } catch (err) {
      console.error('Hiba a válasz ellenőrzésekor:', err);
      setFeedback({ error: true, message: 'Hiba történt' });
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFeedback(null);
    } else {
      completeCheckpoint();
    }
  };

  const completeCheckpoint = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch('/api/student/checkpoint/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ checkpointId, subject, answers })
      });
      if (response.ok) {
        navigate(`/egyeni-gyakorlas/${subject}/roadmap`, {
          state: { completedCheckpoint: checkpointId, xpEarned }
        });
      }
    } catch (err) {
      console.error('Hiba a fejezet lezárásakor:', err);
    }
  };

  const handleMentorChat = async (e) => {
    e.preventDefault();
    if (!mentorInput.trim()) return;

    const userMsg = mentorInput;
    addChatMessage('user', userMsg);
    setMentorInput('');
    setMentorLoading(true);

    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch('/api/assignments/student/tutor', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionText: questions[currentIndex]?.questionText,
          correctAnswer: questions[currentIndex]?.correctAnswer,
          studentAnswer: answers[questions[currentIndex]?._id],
          chatHistory: chatMessages.slice(-5)
        })
      });
      if (response.ok) {
        const data = await response.json();
        addChatMessage('bot', data.message);
      }
    } catch (err) {
      console.error('Hiba a mentor chat során:', err);
    } finally {
      setMentorLoading(false);
    }
  };

  const addChatMessage = (role, content) => {
    setChatMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  if (loading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div id="content" className="checkpoint-practice">
        <p>Hiba: Nincs betöltött kérdés</p>
      </div>
    );
  }

  const question = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answered = answers[question._id] !== undefined;

  return (
    <div id="content" className="checkpoint-practice">
      <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}/roadmap`)}>
        <FaArrowLeft /> Vissza
      </button>

      <div className="practice-wrapper">
        {/* Bal oldal – Feladat */}
        <div className="practice-left">
          <div className="question-header">
            <h2>{currentIndex + 1} / {questions.length}</h2>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="xp-display">+{xpEarned} XP</span>
          </div>

          <div className="question-card">
            <h3>{question.questionText}</h3>

            {/* Kérdéstípusok renderelése */}
            {question.questionType === 'multiple_choice' && (
              <div className="options">
                {question.options && question.options.map((opt, idx) => (
                  <label key={idx} className="option">
                    <input
                      type="radio"
                      name={`q-${question._id}`}
                      value={opt}
                      checked={answers[question._id] === opt}
                      onChange={() => handleAnswerChange(question._id, opt)}
                    />
                    <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                  </label>
                ))}
              </div>
            )}

            {question.questionType === 'true_false' && (
              <div className="true-false-btns">
                <button
                  className={`tf-btn ${answers[question._id] === 'igaz' ? 'selected' : ''}`}
                  onClick={() => handleAnswerChange(question._id, 'igaz')}
                >
                  ✓ Igaz
                </button>
                <button
                  className={`tf-btn ${answers[question._id] === 'hamis' ? 'selected' : ''}`}
                  onClick={() => handleAnswerChange(question._id, 'hamis')}
                >
                  ✗ Hamis
                </button>
              </div>
            )}

            {question.questionType === 'short_answer' && (
              <textarea
                className="answer-input"
                placeholder="Válaszod itt..."
                value={answers[question._id] || ''}
                onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                rows="4"
              />
            )}

            {question.questionType === 'fill_blank' && (
              <input
                type="text"
                className="answer-input"
                placeholder="Hiányzó szó/kifejezés"
                value={answers[question._id] || ''}
                onChange={(e) => handleAnswerChange(question._id, e.target.value)}
              />
            )}

            {question.questionType === 'matching' && (
              <div className="matching">
                {question.pairs && question.pairs.map((pair, idx) => (
                  <div key={idx} className="match-row">
                    <span>{pair.left}</span>
                    <select
                      value={answers[`${question._id}-${idx}`] || ''}
                      onChange={(e) => handleAnswerChange(`${question._id}-${idx}`, e.target.value)}
                    >
                      <option value="">Válassz...</option>
                      {question.options && question.options.map((opt, optIdx) => (
                        <option key={optIdx} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {question.questionType === 'ordering' && (
              <div className="ordering">
                <p>Sorba rendezendő:</p>
                {question.items && question.items.map((item, idx) => (
                  <div key={idx} className="order-item">{idx + 1}. {item}</div>
                ))}
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`feedback ${feedback.isCorrect ? 'correct' : feedback.error ? 'error' : 'incorrect'}`}>
                {feedback.loading && <p>Ellenőrzés...</p>}
                {!feedback.loading && (
                  <>
                    <p>{feedback.message}</p>
                    {feedback.hint && <p className="hint">💡 {feedback.hint}</p>}
                  </>
                )}
              </div>
            )}

            {/* Gombok */}
            <div className="action-buttons">
              {!feedback ? (
                <button className="check-btn" onClick={handleCheckAnswer} disabled={!answered}>
                  Ellenőrzés
                </button>
              ) : (
                <button className="next-btn" onClick={handleNextQuestion}>
                  {currentIndex === questions.length - 1 ? 'Fejezet befejezése' : 'Következő kérdés'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Jobb oldal – AI Mentor */}
        <div className={`practice-right ${isChatOpen ? 'open' : 'closed'}`}>
          <div className="chat-header">
            <h4>🤖 AI Tanár</h4>
            <button className="chat-toggle" onClick={() => setIsChatOpen(!isChatOpen)}>
              {isChatOpen ? <FaChevronDown /> : <FaChevronUp />}
            </button>
          </div>

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
                <div className="typing-dots"><span></span><span></span><span></span></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-form" onSubmit={handleMentorChat}>
            <input
              type="text"
              placeholder="Kérdésed..."
              value={mentorInput}
              onChange={(e) => setMentorInput(e.target.value)}
              disabled={mentorLoading}
            />
            <button type="submit" disabled={mentorLoading || !mentorInput.trim()}>
              <FaPaperPlane />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CheckpointPractice;
