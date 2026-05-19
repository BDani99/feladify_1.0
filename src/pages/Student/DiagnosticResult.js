import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../api/config';
import { FaCheckCircle, FaExclamationTriangle, FaChartLine, FaBrain, FaRedo, FaHome, FaChevronDown, FaChevronUp, FaSearch } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import '../../styles/Student/DiagnosticResult.css';

const SUBJECT_COLORS = {
  'Matematika': '#3498db',
  'Nyelvtan': '#ef4444',
  'Irodalom': '#34d399',
  'Angol': '#10b981',
  'Német': '#f39c12',
  'Környezetismeret': '#9b59b6',
  'Történelem': '#f43f5e',
  'Fizika': '#60a5fa',
  'Biológia': '#4ade80',
  'Földrajz': '#fbbf24'
};

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
});

const formatAnswer = (answer, questionType) => {
  if (answer === null || answer === undefined) return '(nem válaszolt)';
  if (questionType === 'matching' && typeof answer === 'object' && !Array.isArray(answer)) {
    return Object.entries(answer).map(([k, v]) => `${k} → ${v}`).join(', ');
  }
  if (questionType === 'ordering' && Array.isArray(answer)) {
    return answer.join(' → ');
  }
  return String(answer);
};

const QuestionCard = ({ item, index, subject }) => {
  const [open, setOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const handleAnalysis = async () => {
    if (analysis) { setAnalysisOpen(v => !v); return; }
    setAnalysisLoading(true);
    setAnalysisOpen(true);
    try {
      const res = await fetch(`${API_BASE_URL}/student/diagnostic/question-analysis`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subject,
          questionText: item.questionText,
          correctAnswer: item.correctAnswer,
          studentAnswer: item.studentAnswer,
          isCorrect: item.isCorrect
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      } else {
        setAnalysis({ explanation: 'Nem sikerült az elemzés betöltése.', whyWrong: null, conceptTip: null });
      }
    } catch {
      setAnalysis({ explanation: 'Hiba az elemzés lekérésekor.', whyWrong: null, conceptTip: null });
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className={`question-accordion ${item.isCorrect ? 'correct' : 'incorrect'}`}>
      <button className="question-accordion-header" onClick={() => setOpen(v => !v)}>
        <span className="q-index">{index + 1}.</span>
        <span className={`q-result-icon ${item.isCorrect ? 'correct' : 'incorrect'}`}>
          {item.isCorrect ? <FaCheckCircle /> : <FaExclamationTriangle />}
        </span>
        <span className="q-text-preview">{item.questionText.length > 80 ? item.questionText.slice(0, 80) + '…' : item.questionText}</span>
        <span className="q-category-tag">{item.category}</span>
        <span className="q-toggle-icon">{open ? <FaChevronUp /> : <FaChevronDown />}</span>
      </button>

      {open && (
        <div className="question-accordion-body">
          <p className="q-full-text"><strong>Kérdés:</strong> {item.questionText}</p>

          <div className="q-answers">
            <div className={`q-answer-box student ${item.isCorrect ? 'correct' : 'incorrect'}`}>
              <span className="q-answer-label">Te válaszoltad:</span>
              <span className="q-answer-value">{formatAnswer(item.studentAnswer, item.questionType)}</span>
            </div>
            {!item.isCorrect && (
              <div className="q-answer-box correct-ans">
                <span className="q-answer-label">Helyes válasz:</span>
                <span className="q-answer-value">{formatAnswer(item.correctAnswer, item.questionType)}</span>
              </div>
            )}
          </div>

          <button className="q-analysis-btn" onClick={handleAnalysis} disabled={analysisLoading}>
            <FaSearch /> {analysis ? (analysisOpen ? 'Elemzés elrejtése' : 'Elemzés megmutatása') : 'AI elemzés kérése'}
          </button>

          {analysisOpen && (
            <div className="q-analysis-result">
              {analysisLoading ? (
                <div className="q-analysis-loading"><span className="q-analysis-spinner" /><span>Elemzés generálása...</span></div>
              ) : analysis ? (
                <>
                  <div className="q-analysis-section">
                    <strong>Magyarázat:</strong>
                    <ReactMarkdown>{analysis.explanation}</ReactMarkdown>
                  </div>
                  {analysis.whyWrong && (
                    <div className="q-analysis-section wrong">
                      <strong>Miért volt helytelen?</strong>
                      <ReactMarkdown>{analysis.whyWrong}</ReactMarkdown>
                    </div>
                  )}
                  {analysis.conceptTip && (
                    <div className="q-analysis-section tip">
                      <strong>💡 Tipp:</strong>
                      <ReactMarkdown>{analysis.conceptTip}</ReactMarkdown>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DiagnosticResult = () => {
  const { subject } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  const { resultId, score, categoryAnalysis, aiAnalysis, perQuestionResults } = location.state || {};

  useEffect(() => {
    if (score !== undefined && categoryAnalysis && aiAnalysis) {
      setResult({
        subject,
        score,
        categoryAnalysis,
        aiAnalysis,
        perQuestionResults: perQuestionResults || [],
        totalQuestions: categoryAnalysis.reduce((sum, cat) => sum + cat.totalQuestions, 0),
        correctAnswers: categoryAnalysis.reduce((sum, cat) => sum + cat.correctAnswers, 0)
      });
      setLoading(false);
    } else {
      setError('Nem található eredmény adat. Kérlek, végezz el egy szintfelmérőt.');
      setLoading(false);
    }
  }, [subject, score, categoryAnalysis, aiAnalysis, perQuestionResults]);

  if (loading) {
    return (
      <div id="content">
        <div className="diagnostic-result-container">
          <div className="result-header">
            <div className="score-circle">
              <span className="score-label">Eredmény</span>
            </div>
            <div className="result-info">
              <h1>{subject} Diagnosztika</h1>
              <p className="result-subtitle">Az eredmények betöltése...</p>
            </div>
          </div>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div id="content">
        <div className="diagnostic-result-container">
          <div className="error-state">
            <FaExclamationTriangle className="error-icon" />
            <h2>Hiba történt</h2>
            <p>{error || 'Nem található eredmény adat.'}</p>
            <div className="error-actions">
              <button className="btn btn-primary" onClick={() => navigate('/egyeni-gyakorlas')}>
                <FaHome /> Vissza
              </button>
              <button className="btn btn-secondary" onClick={() => navigate(`/egyeni-gyakorlas/${subject}`)}>
                <FaRedo /> Újra tesztel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const subjectColor = SUBJECT_COLORS[result.subject] || '#3498db';
  const scoreColor = result.score >= 70 ? '#10b981' : result.score >= 40 ? '#f39c12' : '#ef4444';

  return (
    <div id="content">
      <div className="diagnostic-result-container">
        {/* Header with score */}
        <div className="result-header">
          <div className="score-circle" style={{ borderColor: scoreColor }}>
            <span className="score-value" style={{ color: scoreColor }}>
              {Math.round(result.score)}%
            </span>
            <span className="score-label">Eredmény</span>
          </div>

          <div className="result-info">
            <h1>{result.subject} Diagnosztika</h1>
            <p className="result-subtitle">
              {result.totalQuestions} kérdésből {result.correctAnswers} helyes válasz
            </p>
          </div>
        </div>

        {/* AI Analysis Summary */}
        {result.aiAnalysis && (
          <div className="ai-analysis-summary">
            <div className="ai-header">
              <FaBrain className="ai-icon" />
              <h2>AI Elemzés</h2>
            </div>

            <div className="ai-feedback">
              <p>{result.aiAnalysis.personalizedFeedback}</p>
            </div>

            <div className="performance-badge">
              <span className={`badge ${result.aiAnalysis.overallPerformance}`}>
                {result.aiAnalysis.overallPerformance === 'excellent' && '🏆 Kiváló!'}
                {result.aiAnalysis.overallPerformance === 'good' && '👍 Jó!'}
                {result.aiAnalysis.overallPerformance === 'average' && '📊 Közepes'}
                {result.aiAnalysis.overallPerformance === 'needs_improvement' && '💪 Fejlesztésre szorul'}
              </span>
            </div>
          </div>
        )}

        {/* Category Analysis */}
        {result.categoryAnalysis && result.categoryAnalysis.length > 0 && (
          <div className="category-analysis">
            <h2>
              <FaChartLine /> Részletes elemzés témakörönként
            </h2>

            <div className="categories-grid">
              {result.categoryAnalysis
                .sort((a, b) => a.score - b.score)
                .map((category, index) => {
                  const catScore = category.score;
                  const color = catScore >= 70 ? '#10b981' : catScore >= 40 ? '#f39c12' : '#ef4444';

                  return (
                    <div
                      key={index}
                      className="category-card"
                      style={{ borderLeftColor: color }}
                    >
                      <div className="category-header">
                        <h3>{category.category}</h3>
                        <span className="category-score" style={{ color }}>
                          {Math.round(catScore)}%
                        </span>
                      </div>

                      <div className="category-progress">
                        <div
                          className="category-progress-bar"
                          style={{ width: `${catScore}%`, backgroundColor: color }}
                        />
                      </div>

                      <div className="category-stats">
                        <span>{category.correctAnswers}/{category.totalQuestions} helyes</span>
                      </div>

                      {category.weaknesses && category.weaknesses.length > 0 && (
                        <div className="category-weaknesses">
                          <FaExclamationTriangle />
                          <span>{category.weaknesses[0]}</span>
                        </div>
                      )}

                      {category.strengths && category.strengths.length > 0 && (
                        <div className="category-strengths">
                          <FaCheckCircle />
                          <span>{category.strengths[0]}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Weaknesses Focus */}
        {result.aiAnalysis?.weaknesses && result.aiAnalysis.weaknesses.length > 0 && (
          <div className="focus-areas">
            <h2>
              <FaBrain /> Fókuszálandó területek
            </h2>

            <div className="weaknesses-list">
              {result.aiAnalysis.weaknesses.map((weakness, index) => (
                <div key={index} className="weakness-item">
                  <div className="weakness-header">
                    <span className={`priority-badge priority-${weakness.priority}`}>
                      {weakness.priority <= 2 ? '🔴 Magas prioritás' : '🟡 Közepes prioritás'}
                    </span>
                    <span className="weakness-category">{weakness.category}</span>
                  </div>
                  <p className="weakness-description">{weakness.description}</p>
                  <p className="weakness-recommendation">
                    Ajánlott gyakorlás: {weakness.recommendedPractice} óra
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Path */}
        {result.aiAnalysis?.learningPath?.recommendedOrder?.length > 0 && (
          <div className="learning-path">
            <h2>
              <FaChartLine /> Ajánlott tanulási útvonal
            </h2>

            <div className="path-timeline">
              {result.aiAnalysis.learningPath.recommendedOrder.map((category, index) => (
                <div key={index} className="path-node">
                  <div className="node-number">{index + 1}</div>
                  <div className="node-content">
                    <h4>{category}</h4>
                    <p>Gyakorold ezt a témakört a személyre szabott útvonaladon!</p>
                  </div>
                </div>
              ))}
            </div>

            {result.aiAnalysis.learningPath.estimatedTime > 0 && (
              <div className="estimated-time">
                <strong>Becsült teljes idő:</strong> {result.aiAnalysis.learningPath.estimatedTime} óra
              </div>
            )}
          </div>
        )}

        {/* Per-question accordion */}
        {result.perQuestionResults && result.perQuestionResults.length > 0 && (
          <div className="questions-detail-section">
            <button
              className="questions-detail-toggle"
              onClick={() => setQuestionsOpen(v => !v)}
            >
              <FaChartLine />
              <span>Kérdések részletei ({result.perQuestionResults.length} kérdés)</span>
              <span className="questions-summary">
                ✅ {result.perQuestionResults.filter(q => q.isCorrect).length} helyes &nbsp;
                ❌ {result.perQuestionResults.filter(q => !q.isCorrect).length} helytelen
              </span>
              {questionsOpen ? <FaChevronUp /> : <FaChevronDown />}
            </button>

            {questionsOpen && (
              <div className="questions-accordion-list">
                {result.perQuestionResults.map((item, idx) => (
                  <QuestionCard key={item.questionId || idx} item={item} index={idx} subject={result.subject} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="result-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/egyeni-gyakorlas/${subject}/roadmap`)}
          >
            <FaHome /> Tanulási térkép megtekintése
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => navigate('/egyeni-gyakorlas')}
          >
            <FaRedo /> Másik tantárgy
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticResult;
