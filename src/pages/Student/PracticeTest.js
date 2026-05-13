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
  const [submitting, setSubmitting] = useState(false);
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade: user?.className || '4. osztály' })
      });
      if (response.ok) {
        const data = await response.json();
        setTestId(data.testId);
        setQuestions(data.questions || []);
      } else {
        const err = await response.json();
        alert(`Hiba: ${err.message}`);
      }
    } catch (err) {
      console.error('Hiba a teszt indításakor:', err);
      alert('Hiba a teszt indításakor.');
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

  const handleAnswerChange = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleOrderingMove = (qid, items, fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= items.length) return;
    const current = answers[qid] || [...items];
    const next = [...current];
    [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
    setAnswers(prev => ({ ...prev, [qid]: next }));
  };

  const isAnswered = (question) => {
    const qid = question.questionId;
    if (question.questionType === 'matching') {
      return (question.pairs || []).every((_, idx) => answers[`${qid}-${idx}`]);
    }
    if (question.questionType === 'ordering') return true;
    return answers[qid] !== undefined && answers[qid] !== '';
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Matching válaszok összegyűjtése: { [qid]: { "left": "right", ... } }
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
          // Töröljük az ideiglenes per-pair kulcsokat
          (q.pairs || []).forEach((_, idx) => delete finalAnswers[`${qid}-${idx}`]);
        }
        // Ordering: ha nincs módosítva, az eredeti sorrendet küldjük
        if (q.questionType === 'ordering' && !finalAnswers[q.questionId]) {
          finalAnswers[q.questionId] = [...(q.items || [])];
        }
      });

      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch('/api/student/diagnostic/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, subject, answers: finalAnswers })
      });
      if (response.ok) {
        const data = await response.json();
        navigate(`/egyeni-gyakorlas/${subject}/eredmeny`, { state: { resultId: data.resultId } });
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

  if (loading) return <div id="content"><LoadingSpinner /></div>;

  if (!questions || questions.length === 0) {
    return (
      <div id="content" className="practice-test">
        <p>Hiba: Nem sikerült a kérdéseket betölteni.</p>
        <button onClick={() => navigate('/egyeni-gyakorlas')}>Vissza</button>
      </div>
    );
  }

  const question = questions[currentIndex];
  const qid = question.questionId;
  const answered = isAnswered(question);
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = questions.filter(q => isAnswered(q)).length;

  return (
    <div id="content" className="practice-test">
      <div className="test-header">
        <button className="back-btn" onClick={() => navigate(`/egyeni-gyakorlas/${subject}`)}>
          <FaArrowLeft /> Vissza
        </button>
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
            className={`dot ${idx === currentIndex ? 'active' : ''} ${isAnswered(q) ? 'answered' : ''}`}
            onClick={() => setCurrentIndex(idx)}
            title={`Kérdés ${idx + 1}`}
          />
        ))}
      </div>

      <div className="question-container">
        <div className="question-category">{question.category}</div>
        <h2>{question.questionText}</h2>

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
          {question.questionType === 'fill_blank' && (
            <input
              type="text"
              className="fill-blank-input"
              placeholder="Írd be a hiányzó szót..."
              value={answers[qid] || ''}
              onChange={e => handleAnswerChange(qid, e.target.value)}
            />
          )}

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

          {/* Sorba rendezés */}
          {question.questionType === 'ordering' && (
            <div className="ordering">
              <p className="ordering-instruction">Rendezd a helyes sorrendbe (▲▼ gombokkal):</p>
              {(answers[qid] || question.items || []).map((item, idx) => (
                <div key={idx} className="order-item">
                  <span className="order-num">{idx + 1}.</span>
                  <span className="order-text">{item}</span>
                  <div className="order-controls">
                    <button
                      onClick={() => handleOrderingMove(qid, answers[qid] || question.items, idx, idx - 1)}
                      disabled={idx === 0}
                      title="Feljebb"
                    >▲</button>
                    <button
                      onClick={() => handleOrderingMove(qid, answers[qid] || question.items, idx, idx + 1)}
                      disabled={idx === (answers[qid] || question.items || []).length - 1}
                      title="Lejjebb"
                    >▼</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nav-buttons">
          <button className="nav-btn prev" onClick={handlePrev} disabled={currentIndex === 0}>
            <FaArrowLeft /> Előző
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              className="nav-btn submit"
              onClick={handleSubmit}
              disabled={submitting || answeredCount < Math.ceil(questions.length * 0.5)}
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
  );
};

export default PracticeTest;
