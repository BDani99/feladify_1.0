import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FaArrowLeft, FaArrowRight, FaCheck, FaTimes, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { submitDiagnosticAnswers } from '../../api/Student/Diagnostic';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Student/DiagnosticTest.css';

const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer',
  MATCHING: 'matching'
};

const SUBJECT_COLORS = {
  'Matematika': '#3498db',
  'Magyar': '#e74c3c',
  'Angol': '#2ecc71',
  'Környezetismeret': '#9b59b6'
};

// Párosítás komponens
const MatchingQuestion = ({ question, onAnswer }) => {
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [selectedRight, setSelectedRight] = useState(null);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (question.options) {
      const left = question.options.map(opt => ({ id: opt.label, text: opt.text }));
      const right = question.options.map(opt => ({ id: opt.label, text: opt.text }));
      
      // Keverjük össze a jobb oldali elemeket
      const shuffledRight = [...right].sort(() => Math.random() - 0.5);
      
      setLeftItems(left);
      setRightItems(shuffledRight);
    }
  }, [question]);

  const handleLeftClick = (item) => {
    // Ellenőrizd, hogy már nincs-e párosítva
    if (matches.some(m => m.leftId === item.id)) return;
    setSelectedLeft(item);
  };

  const handleRightClick = (item) => {
    if (!selectedLeft) return;
    if (matches.some(m => m.rightId === item.id)) return;

    // Új párosítás
    const newMatch = { leftId: selectedLeft.id, rightId: item.id };
    const newMatches = [...matches, newMatch];
    setMatches(newMatches);
    setSelectedLeft(null);

    // Ha minden párosítva van, küldjük el a választ
    if (newMatches.length === leftItems.length) {
      const answer = newMatches.map(m => ({
        left: leftItems.find(l => l.id === m.leftId).text,
        right: rightItems.find(r => r.id === m.rightId).text
      }));
      onAnswer(answer);
    }
  };

  return (
    <div className="matching-container">
      <div className="matching-columns">
        <div className="matching-column">
          <h4> bal oldal</h4>
          {leftItems.map(item => {
            const isMatched = matches.some(m => m.leftId === item.id);
            const isSelected = selectedLeft?.id === item.id;
            return (
              <button
                key={item.id}
                className={`matching-item ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleLeftClick(item)}
                disabled={isMatched}
              >
                {item.text}
              </button>
            );
          })}
        </div>
        
        <div className="matching-lines">
          {matches.map((match, index) => (
            <div key={index} className="matching-line" />
          ))}
        </div>

        <div className="matching-column">
          <h4>jobb oldal</h4>
          {rightItems.map(item => {
            const isMatched = matches.some(m => m.rightId === item.id);
            const isSelected = selectedRight?.id === item.id;
            return (
              <button
                key={item.id}
                className={`matching-item ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleRightClick(item)}
                disabled={isMatched || !selectedLeft}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      </div>
      <p className="matching-hint">
        Kattints egy bal oldali elemre, majd a megfelelő jobb oldali elemre!
      </p>
    </div>
  );
};

const DiagnosticTest = () => {
  const { subject } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { testId, questions, totalQuestions } = location.state || {};
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [startTime] = useState(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  
  const currentQuestion = questions[currentQuestionIndex];
  const subjectColor = SUBJECT_COLORS[subject] || '#3498db';
  const scrollRef = useRef(null);

  useEffect(() => {
    // Ellenőrizd, hogy van-e elég adat
    if (!testId || !questions || questions.length === 0) {
      setError('Nem található teszt adat. Kérlek, indítsd újra a tesztet.');
      return;
    }

    // Initialize answers array
    setAnswers(new Array(questions.length).fill(null));
  }, [testId, questions]);

  useEffect(() => {
    // Scroll to top when question changes
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentQuestionIndex]);

  const handleAnswer = (answer) => {
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = {
      questionId: currentQuestion._id,
      answer,
      timeSpent
    };
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setQuestionStartTime(Date.now());
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setQuestionStartTime(Date.now());
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    // Ellenőrizd, hogy minden kérdésre válaszoltunk-e
    const unansweredCount = answers.filter(a => a === null).length;
    if (unansweredCount > 0) {
      setWarning(`Még ${unansweredCount} kérdésre nem válaszoltál!`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setWarning(null);

    try {
      const formattedAnswers = answers.map(a => ({
        questionId: a.questionId,
        answer: a.answer,
        timeSpent: a.timeSpent
      }));

      const result = await submitDiagnosticAnswers(testId, formattedAnswers);
      console.log('[DiagnosticTest] Test submitted:', result);

      // Navigate to result page
      navigate(`/diagnosztika/${subject}/eredmeny`, {
        state: {
          resultId: result.resultId,
          score: result.score,
          categoryAnalysis: result.categoryAnalysis,
          aiAnalysis: result.aiAnalysis
        }
      });
    } catch (err) {
      console.error('[DiagnosticTest] Error submitting test:', err);
      setError(err.message || 'Hiba történt a beküldéskor');
      setIsSubmitting(false);
    }
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.questionType) {
      case QUESTION_TYPES.MULTIPLE_CHOICE:
        return (
          <div className="question-multiple-choice">
            <div className="options-list">
              {currentQuestion.options.map(option => (
                <button
                  key={option.label}
                  className={`option-button ${answers[currentQuestionIndex]?.answer === option.label ? 'selected' : ''}`}
                  onClick={() => handleAnswer(option.label)}
                >
                  <span className="option-label">{option.label}</span>
                  <span className="option-text">{option.text}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case QUESTION_TYPES.TRUE_FALSE:
        return (
          <div className="question-true-false">
            <div className="options-list horizontal">
              <button
                className={`option-button ${answers[currentQuestionIndex]?.answer === true ? 'selected' : ''}`}
                onClick={() => handleAnswer(true)}
              >
                <FaCheck className="option-icon" />
                <span>Igaz</span>
              </button>
              <button
                className={`option-button ${answers[currentQuestionIndex]?.answer === false ? 'selected' : ''}`}
                onClick={() => handleAnswer(false)}
              >
                <FaTimes className="option-icon" />
                <span>Hamis</span>
              </button>
            </div>
          </div>
        );

      case QUESTION_TYPES.SHORT_ANSWER:
        return (
          <div className="question-short-answer">
            <textarea
              className="short-answer-input"
              placeholder="Írd ide a válaszod..."
              value={answers[currentQuestionIndex]?.answer || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              rows={3}
            />
          </div>
        );

      case QUESTION_TYPES.MATCHING:
        return (
          <MatchingQuestion
            question={currentQuestion}
            onAnswer={(answer) => handleAnswer(answer)}
          />
        );

      default:
        return <p>Ismeretlen kérdéstípus</p>;
    }
  };

  if (!questions || questions.length === 0) {
    return (
      <div id="content">
        <div className="diagnostic-test-container">
          <div className="error-state">
            <FaExclamationTriangle className="error-icon" />
            <h2>Hiba történt</h2>
            <p>{error || 'Nem található teszt adat.'}</p>
            <button className="btn btn-primary" onClick={() => navigate('/adaptiv-terkep')}>
              Vissza a térképre
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="content">
      <div className="diagnostic-test-container" ref={scrollRef}>
        {/* Header with progress */}
        <div className="test-header">
          <div className="progress-info">
            <span className="progress-text">
              {currentQuestionIndex + 1} / {totalQuestions}
            </span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                  backgroundColor: subjectColor
                }}
              />
            </div>
          </div>
          
          <div className="timer">
            <FaClock className="timer-icon" />
            <span>{Math.floor((Date.now() - startTime) / 60000)} perc</span>
          </div>
        </div>

        {/* Question content */}
        <div className="question-content">
          <div className="question-header">
            <span className="question-category">{currentQuestion?.category}</span>
            <span className="question-difficulty">
              Nehézség: {'⭐'.repeat(currentQuestion?.difficulty || 1)}
            </span>
          </div>

          <h2 className="question-text">{currentQuestion?.questionText}</h2>

          {renderQuestion()}
        </div>

        {/* Warnings and errors */}
        {warning && (
          <div className="warning-banner">
            <FaExclamationTriangle /> {warning}
            <button className="warning-dismiss" onClick={() => setWarning(null)}>
              Értettem, folytatom
            </button>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <FaExclamationTriangle /> {error}
          </div>
        )}

        {/* Navigation */}
        <div className="test-navigation">
          <button
            className="nav-button prev"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            <FaArrowLeft /> Előző
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              className="nav-button submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ backgroundColor: subjectColor }}
            >
              {isSubmitting ? <LoadingSpinner size="small" /> : 'Beküldés'}
            </button>
          ) : (
            <button
              className="nav-button next"
              onClick={handleNext}
              disabled={!answers[currentQuestionIndex]}
              style={{ backgroundColor: subjectColor }}
            >
              Következő <FaArrowRight />
            </button>
          )}
        </div>

        {/* Question navigator dots */}
        <div className="question-navigator">
          {questions.map((_, index) => (
            <button
              key={index}
              className={`nav-dot ${index === currentQuestionIndex ? 'active' : ''} ${answers[index] ? 'answered' : ''}`}
              onClick={() => {
                setQuestionStartTime(Date.now());
                setCurrentQuestionIndex(index);
              }}
              title={`${index + 1}. kérdés`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiagnosticTest;