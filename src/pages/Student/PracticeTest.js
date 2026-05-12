import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  const [testId, setTestId] = useState(null);

  useEffect(() => {
    const testIdFromState = location.state?.testId;
    if (testIdFromState) {
      setTestId(testIdFromState);
      fetchDiagnosticTest(testIdFromState);
    } else {
      startNewTest();
    }
  }, [subject]);

  const startNewTest = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch('/api/student/diagnostic/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject, grade: user?.className || '4. osztály' })
      });
      if (response.ok) {
        const data = await response.json();
        setTestId(data.testId);
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Hiba a teszt indításakor:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnosticTest = async (id) => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch(`/api/student/diagnostic/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Hiba a teszt lekérésekor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch('/api/student/diagnostic/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testId,
          subject,
          answers
        })
      });
      if (response.ok) {
        const data = await response.json();
        navigate(`/egyeni-gyakorlas/${subject}/eredmeny`, { state: { resultId: data.resultId } });
      }
    } catch (err) {
      console.error('Hiba a teszt beadásakor:', err);
    }
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
      <div id="content" className="practice-test">
        <p>Hiba: Nem sikerült a kérdéseket betölteni.</p>
        <button onClick={() => navigate('/egyeni-gyakorlas')}>Vissza</button>
      </div>
    );
  }

  const question = questions[currentIndex];
  const answered = answers[question._id] !== undefined;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div id="content" className="practice-test">
      <div className="test-header">
        <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}`)}>
          <FaArrowLeft /> Vissza
        </button>
        <h1>{subject} Szintfelmérő</h1>
        <div className="progress-info">
          {currentIndex + 1} / {questions.length}
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="question-navigator">
        {questions.map((q, idx) => (
          <button
            key={q._id}
            className={`dot ${idx === currentIndex ? 'active' : ''} ${answers[q._id] ? 'answered' : ''}`}
            onClick={() => setCurrentIndex(idx)}
            title={`Kérdés ${idx + 1}`}
          />
        ))}
      </div>

      <div className="question-container">
        <h2>{question.questionText}</h2>

        <div className="question-content">
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
                  <span className="option-text">{String.fromCharCode(65 + idx)}. {opt}</span>
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
              className="short-answer-input"
              placeholder="Válaszod ide..."
              value={answers[question._id] || ''}
              onChange={(e) => handleAnswerChange(question._id, e.target.value)}
              rows="4"
            />
          )}

          {question.questionType === 'fill_blank' && (
            <input
              type="text"
              className="fill-blank-input"
              placeholder="Írd be a hiányzó szót"
              value={answers[question._id] || ''}
              onChange={(e) => handleAnswerChange(question._id, e.target.value)}
            />
          )}

          {question.questionType === 'matching' && (
            <div className="matching">
              {question.pairs && question.pairs.map((pair, idx) => (
                <div key={idx} className="matching-row">
                  <span className="left-item">{pair.left}</span>
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
              <p className="ordering-instruction">Sorba rendezendő elemek:</p>
              {question.items && question.items.map((item, idx) => (
                <div key={idx} className="order-item">
                  <span className="order-num">{idx + 1}.</span>
                  <span>{item}</span>
                </div>
              ))}
              <p className="ordering-note">Jegyezd meg a helyes sorrendet!</p>
            </div>
          )}
        </div>

        <div className="nav-buttons">
          <button className="nav-btn prev" onClick={handlePrev} disabled={currentIndex === 0}>
            <FaArrowLeft /> Előző
          </button>

          {currentIndex === questions.length - 1 ? (
            <button className="nav-btn submit" onClick={handleSubmit} disabled={!answered}>
              <FaCheck /> Beadás
            </button>
          ) : (
            <button className="nav-btn next" onClick={handleNext} disabled={!answered}>
              Következő <FaArrowRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PracticeTest;
