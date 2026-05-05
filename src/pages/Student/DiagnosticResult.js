import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FaCheckCircle, FaExclamationTriangle, FaChartLine, FaBrain, FaRedo, FaHome } from 'react-icons/fa';
import { getDiagnosticResult } from '../../api/Student/Diagnostic';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Student/DiagnosticResult.css';

const SUBJECT_COLORS = {
  'Matematika': '#3498db',
  'Magyar': '#e74c3c',
  'Angol': '#2ecc71',
  'Környezetismeret': '#9b59b6'
};

const DiagnosticResult = () => {
  const { subject } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Location state-ből származó adatok
  const { resultId, score: initialScore, categoryAnalysis: initialCategoryAnalysis, aiAnalysis: initialAiAnalysis } = location.state || {};

  useEffect(() => {
    const loadResult = async () => {
      try {
        if (resultId) {
          const data = await getDiagnosticResult(resultId);
          setResult(data);
        } else if (initialScore !== undefined) {
          // Használjuk a location state-ből származó adatokat
          setResult({
            subject,
            score: initialScore,
            categoryAnalysis: initialCategoryAnalysis,
            aiAnalysis: initialAiAnalysis
          });
        } else {
          setError('Nem található eredmény adat.');
        }
      } catch (err) {
        console.error('[DiagnosticResult] Error loading result:', err);
        setError(err.message || 'Hiba történt az eredmény betöltésekor');
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [resultId, subject, initialScore, initialCategoryAnalysis, initialAiAnalysis]);

  if (loading) {
    return (
      <div id="content">
        <div className="loading-container">
          <LoadingSpinner />
          <p className="loading-text">Az eredmények betöltése...</p>
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
              <button className="btn btn-primary" onClick={() => navigate('/adaptiv-terkep')}>
                <FaHome /> Vissza a térképre
              </button>
              <button className="btn btn-secondary" onClick={() => navigate(`/diagnosztika/${subject}`)}>
                <FaRedo /> Újra tesztel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const subjectColor = SUBJECT_COLORS[result.subject] || '#3498db';
  const scoreColor = result.score >= 70 ? '#2ecc71' : result.score >= 40 ? '#f39c12' : '#e74c3c';

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
                .sort((a, b) => a.score - b.score) // Leggyengébb elöl
                .map((category, index) => {
                  const score = category.score;
                  const color = score >= 70 ? '#2ecc71' : score >= 40 ? '#f39c12' : '#e74c3c';
                  
                  return (
                    <div 
                      key={index} 
                      className="category-card"
                      style={{ borderLeftColor: color }}
                    >
                      <div className="category-header">
                        <h3>{category.category}</h3>
                        <span className="category-score" style={{ color }}>
                          {Math.round(score)}%
                        </span>
                      </div>
                      
                      <div className="category-progress">
                        <div 
                          className="category-progress-bar"
                          style={{ 
                            width: `${score}%`,
                            backgroundColor: color
                          }}
                        />
                      </div>
                      
                      <div className="category-stats">
                        <span>
                          {category.correctAnswers}/{category.totalQuestions} helyes
                        </span>
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
        {result.aiAnalysis?.learningPath && (
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
            
            <div className="estimated-time">
              <strong>Becsült teljes idő:</strong> {result.aiAnalysis.learningPath.estimatedTime} óra
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="result-actions">
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/adaptiv-terkep')}
            style={{ backgroundColor: subjectColor }}
          >
            <FaHome /> Ugrás a személyre szabott útvonalamra
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={() => navigate(`/diagnosztika/${subject}`)}
          >
            <FaRedo /> Másik tantárgy tesztelése
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticResult;