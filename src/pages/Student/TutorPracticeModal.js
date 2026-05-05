import React, { useState, useEffect, useCallback } from 'react';
import { getPracticeQuestion, checkAnswer } from '../../api/Student/Tutor';
import { FaBrain, FaCheck, FaTimes, FaStar, FaArrowRight, FaRedo } from 'react-icons/fa';
import logo from '../../assets/logo-400.png';
import '../../styles/Student/TutorPracticeModal.css';

// Pontszám az alapján, hány próbálkozásnál sikerült
const scoreFromAttempts = (attempts) => {
  if (attempts <= 1) return 100;
  if (attempts === 2) return 75;
  if (attempts === 3) return 50;
  return 25;
};

const TutorPracticeModal = ({ node, aiTone = 'teacher', hintLevel = 'normal', onClose, onComplete }) => {
  const [phase, setPhase] = useState('loading'); // loading | question | feedback | done
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [aiMessage, setAiMessage] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadQuestion = useCallback(async () => {
    setPhase('loading');
    setLoadError('');
    setSelectedAnswer('');
    setTextAnswer('');
    setAttempts(0);
    setAiMessage('');
    setIsCorrect(false);
    try {
      const q = await getPracticeQuestion(node.subject, node.topic);
      setQuestion(q);
      setPhase('question');
    } catch (err) {
      setLoadError('Nem sikerült betölteni a kérdést. Próbáld újra!');
      setPhase('loading');
    }
  }, [node.subject, node.topic]);

  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  const getStudentAnswer = () =>
    question?.type === 'shorttext' ? textAnswer : selectedAnswer;

  const handleSubmitAnswer = async () => {
    const answer = getStudentAnswer();
    if (!answer.trim()) return;

    setLoadingCheck(true);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    try {
      const result = await checkAnswer({
        subject: node.subject,
        topic: node.topic,
        questionText: question.questionText,
        questionType: question.type,
        studentAnswer: answer,
        correctAnswer: question.correctAnswer,
        attemptNumber: newAttempts,
        tone: aiTone
      });

      if (result.correct) {
        setIsCorrect(true);
        setAiMessage(result.message || 'Helyes! Szuper munka! 🎉');
        setFinalScore(scoreFromAttempts(newAttempts));
        setPhase('feedback');
      } else {
        // Lenient mode: after 2 wrong attempts, give the answer
        const maxAttempts = hintLevel === 'lenient' ? 2 : 3;
        if (newAttempts >= maxAttempts) {
          setIsCorrect(false);
          setAiMessage(`A helyes válasz: **${question.correctAnswer}**\n\n${question.explanation || ''}`);
          setFinalScore(scoreFromAttempts(newAttempts + 1));
          setPhase('feedback');
        } else {
          setAiMessage(result.hint || 'Gondold át újra! Próbálkozz még egyszer.');
          setSelectedAnswer('');
          setTextAnswer('');
          setPhase('question');
        }
      }
    } catch (err) {
      setAiMessage('Hiba történt az ellenőrzés során. Próbáld újra!');
    } finally {
      setLoadingCheck(false);
    }
  };

  const handleFinish = () => {
    onComplete(finalScore ?? 25);
  };

  const handleNewQuestion = () => {
    loadQuestion();
  };

  const renderAnswerArea = () => {
    if (!question) return null;
    if (question.type === 'shorttext') {
      return (
        <input
          type="text"
          className="practice-text-input"
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          placeholder="Írd ide a választ..."
          onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
          autoFocus
        />
      );
    }
    const opts = question.type === 'truefalse'
      ? ['Igaz', 'Hamis']
      : (question.options || []);
    return (
      <div className="practice-options">
        {opts.map((opt, i) => (
          <button
            key={i}
            className={`practice-option${selectedAnswer === opt ? ' selected' : ''}`}
            onClick={() => setSelectedAnswer(opt)}
          >
            {question.type === 'mcq' && (
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            )}
            <span>{opt}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="practice-overlay" onClick={onClose}>
      <div className="practice-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="practice-header">
          <div className="practice-node-info">
            <span className="practice-subject">{node.subject}</span>
            <span className="practice-topic">{node.topic}</span>
          </div>
          {attempts > 0 && (
            <div className="practice-attempts">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`attempt-dot ${attempts >= n ? (isCorrect && attempts === n ? 'correct' : 'used') : ''}`}
                />
              ))}
            </div>
          )}
          <button className="practice-close" onClick={onClose} title="Bezárás">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="practice-body">

          {/* Loading */}
          {phase === 'loading' && !loadError && (
            <div className="practice-loading">
              <FaBrain className="loading-brain" />
              <p>Kérdés generálása...</p>
            </div>
          )}

          {loadError && (
            <div className="practice-loading">
              <p className="practice-error">{loadError}</p>
              <button className="practice-btn primary" onClick={loadQuestion}>
                <FaRedo /> Újrapróbálás
              </button>
            </div>
          )}

          {/* Question phase */}
          {phase === 'question' && question && (
            <>
              <div className="practice-question-area">
                {attempts > 0 && aiMessage && (
                  <div className="ai-hint-banner">
                    <img src={logo} alt="AI" className="ai-avatar-sm" />
                    <p>{aiMessage}</p>
                  </div>
                )}
                <p className="practice-question-text">{question.questionText}</p>
                {renderAnswerArea()}
              </div>

              <button
                className="practice-btn primary submit-btn"
                onClick={handleSubmitAnswer}
                disabled={loadingCheck || !getStudentAnswer().trim()}
              >
                {loadingCheck ? 'Ellenőrzés...' : 'Beküldés'}
              </button>
            </>
          )}

          {/* Feedback phase */}
          {phase === 'feedback' && (
            <div className="practice-feedback-area">
              <div className={`feedback-result ${isCorrect ? 'correct' : 'incorrect'}`}>
                {isCorrect
                  ? <FaCheck className="result-icon correct" />
                  : <FaTimes className="result-icon incorrect" />}
                <p className="result-label">
                  {isCorrect ? 'Helyes válasz!' : 'Nem sikerült ezúttal'}
                </p>
              </div>

              {/* AI feedback */}
              <div className="ai-feedback-strip">
                <img src={logo} alt="AI Tanár" className="ai-avatar" />
                <div className="ai-feedback-text">
                  <strong>AI Tanár</strong>
                  <p>{aiMessage}</p>
                  {!isCorrect && (
                    <p className="explanation-text">{question?.explanation}</p>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="score-earned">
                <FaStar className="star-icon" />
                <span>{finalScore}% elért eredmény</span>
              </div>

              {/* Actions */}
              <div className="practice-actions">
                <button className="practice-btn secondary" onClick={handleFinish}>
                  Befejezés
                </button>
                <button className="practice-btn primary" onClick={handleNewQuestion}>
                  <FaArrowRight /> Újabb kérdés
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Assistant Strip (bottom) – visible during question phase */}
        {phase === 'question' && attempts === 0 && (
          <div className="ai-assistant-strip">
            <img src={logo} alt="AI Tanár" className="ai-avatar-sm" />
            <p>Üdv! Én vagyok az AI Tanárod. Oldd meg a feladatot, és segítek, ha elakadtál! 🎓</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default TutorPracticeModal;
