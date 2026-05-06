import React, { useState, useEffect, useCallback } from 'react';
import { getPracticeQuestionSet, checkAnswer } from '../../api/Student/Tutor';
import { FaBrain, FaCheck, FaTimes, FaStar, FaRedo, FaRobot, FaLightbulb } from 'react-icons/fa';
import '../../styles/Student/TutorPracticeModal.css';

const TutorPracticeModal = ({ checkpoint, subject, onClose, onComplete }) => {
  const [phase, setPhase] = useState('loading'); // loading | question | feedback
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [answers, setAnswers] = useState([]);
  const [attemptCounts, setAttemptCounts] = useState([]);
  const [aiMessage, setAiMessage] = useState('');
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);

  const loadQuestions = useCallback(async () => {
    setPhase('loading');
    setLoadError('');
    setSelectedAnswer('');
    setTextAnswer('');
    setAnswers([]);
    setAttemptCounts([]);
    setAiMessage('');
    setIsCorrect(false);

    try {
      // 3 kérdést kérünk az adott nehézségen
      const result = await getPracticeQuestionSet(subject, checkpoint.topic, checkpoint.difficulty, 3);
      const qset = result.questions || [];
      setQuestions(qset);
      setAnswers(new Array(qset.length).fill(null));
      setAttemptCounts(new Array(qset.length).fill(0));
      setCurrentIndex(0);
      setPhase('question');
    } catch (err) {
      console.error('[TutorPracticeModal] loadQuestions error:', err);
      setLoadError('Nem sikerült betölteni a gyakorló kérdéssort. Próbáld újra!');
      setPhase('loading');
    }
  }, [checkpoint, subject]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const currentQuestion = questions[currentIndex];

  const getStudentAnswer = () => {
    if (!currentQuestion) return '';
    return currentQuestion.type === 'shorttext' ? textAnswer : selectedAnswer;
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;
    const answer = getStudentAnswer();
    if (!answer || !answer.toString().trim()) return;

    setLoadingCheck(true);
    const newAttemptCounts = [...attemptCounts];
    newAttemptCounts[currentIndex] += 1;
    setAttemptCounts(newAttemptCounts);

    try {
      const result = await checkAnswer({
        subject: subject,
        topic: checkpoint.topic,
        questionText: currentQuestion.questionText,
        questionType: currentQuestion.type,
        studentAnswer: answer,
        correctAnswer: currentQuestion.correctAnswer,
        attemptNumber: newAttemptCounts[currentIndex]
      });

      if (result.correct) {
        // Helyes válasz esetén
        const newAnswers = [...answers];
        newAnswers[currentIndex] = {
          answer,
          correct: true,
          questionText: currentQuestion.questionText
        };
        setAnswers(newAnswers);
        
        setAiMessage(result.message || 'Helyes válasz! Szép munka, lépjünk is tovább!');
        setIsCorrect(true);

        // Rövid várakozás után jön a következő kérdés vagy az összegzés
        if (currentIndex < questions.length - 1) {
          setTimeout(() => {
            setCurrentIndex(currentIndex + 1);
            setSelectedAnswer('');
            setTextAnswer('');
            setAiMessage('');
            setIsCorrect(false);
          }, 1500);
        } else {
          setTimeout(() => {
            setPhase('feedback');
          }, 1500);
        }
      } else {
        // Helytelen válasz esetén jön a Szókratészi mentorálás (nincs továbblépés!)
        setAiMessage(result.hint || 'Ebbe még gondolj bele egy kicsit! Próbáld más szemszögből megközelíteni.');
        setIsCorrect(false);
        // Csak a kiválasztott választ töröljük, a szövegesnél benne hagyjuk, hogy javíthassa
        if (currentQuestion.type !== 'shorttext') {
          setSelectedAnswer('');
        }
      }
    } catch (err) {
      console.error('[TutorPracticeModal] checkAnswer error:', err);
      setAiMessage('Hiba történt az ellenőrzés során. Kérlek, próbáld újra!');
    } finally {
      setLoadingCheck(false);
    }
  };

  const computeFinalScore = () => {
    const correctCount = answers.filter(a => a?.correct).length;
    return Math.round((correctCount / questions.length) * 100);
  };

  const handleFinish = () => {
    onComplete({
      score: computeFinalScore(),
      answers: answers.map((item, index) => ({
        questionText: questions[index]?.questionText,
        studentAnswer: item?.answer,
        correct: item?.correct || false
      }))
    });
  };

  const renderAnswerArea = () => {
    if (!currentQuestion) return null;

    if (currentQuestion.type === 'shorttext') {
      return (
        <textarea
          className="practice-text-input"
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          placeholder="Ide írd a válaszod..."
          rows={3}
          autoFocus
          disabled={isCorrect || loadingCheck}
        />
      );
    }

    const options = currentQuestion.options || [];
    return (
      <div className="practice-options">
        {options.map((opt, i) => (
          <button
            key={i}
            className={`practice-option ${selectedAnswer === opt ? 'selected' : ''}`}
            onClick={() => setSelectedAnswer(opt)}
            disabled={isCorrect || loadingCheck}
          >
            {currentQuestion.type === 'mcq' && (
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            )}
            <span className="option-text">{opt}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="practice-overlay" onClick={onClose}>
      <div className="practice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="practice-header">
          <div className="practice-node-info">
            <span className="practice-subject">{subject}</span>
            <span className="practice-topic">{checkpoint.topic || 'Kihívás'}</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="Bezárás">
            <FaTimes />
          </button>
        </div>

        <div className="practice-body">
          {phase === 'loading' && !loadError && (
            <div className="practice-loading">
              <FaBrain className="loading-brain" />
              <p>Feladatok generálása AI segítséggel...</p>
            </div>
          )}

          {loadError && (
            <div className="practice-loading error-state">
              <p className="practice-error">{loadError}</p>
              <button className="btn btn-primary" onClick={loadQuestions}>
                <FaRedo /> Újrapróbálás
              </button>
            </div>
          )}

          {phase === 'question' && currentQuestion && (
            <>
              <div className="question-meta">
                <div className="progress-indicator">
                  Kérdés: {currentIndex + 1} / {questions.length}
                </div>
                <div className="difficulty-indicator">
                  Nehézség: {checkpoint.difficulty}
                </div>
              </div>

              {aiMessage && (
                <div className={`ai-hint-banner ${isCorrect ? 'correct' : 'hint'}`}>
                  <div className="ai-icon">
                    {isCorrect ? <FaCheck /> : <FaLightbulb />}
                  </div>
                  <p>{aiMessage}</p>
                </div>
              )}

              <div className="practice-question-area">
                <h3 className="practice-question-text">{currentQuestion.questionText}</h3>
                {renderAnswerArea()}
              </div>

              <div className="practice-actions">
                <button
                  className="btn btn-primary submit-btn"
                  onClick={handleSubmitAnswer}
                  disabled={loadingCheck || !getStudentAnswer().toString().trim() || isCorrect}
                >
                  {loadingCheck ? 'Ellenőrzés...' : 'Válasz ellenőrzése'}
                </button>
              </div>
            </>
          )}

          {phase === 'feedback' && (
            <div className="practice-feedback-area">
              <div className="feedback-result success">
                <FaStar className="result-icon correct" />
                <h2>Küldetés Teljesítve!</h2>
              </div>

              <div className="score-earned">
                <span>Eredmény:</span>
                <strong>{computeFinalScore()}%</strong>
              </div>
              
              <p className="feedback-text">
                Büszke lehetsz magadra, sikeresen végigmentél a feladatokon!
              </p>

              <div className="practice-actions center">
                <button className="btn btn-primary" onClick={handleFinish}>
                  Tovább a térképre
                </button>
              </div>
            </div>
          )}
        </div>

        {phase === 'question' && (
          <div className="ai-assistant-strip">
            <FaRobot className="ai-avatar-icon" />
            <p>Az AI mentorod figyeli a válaszaidat, és segít rávezetni a megoldásra, ha elakadnál!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorPracticeModal;