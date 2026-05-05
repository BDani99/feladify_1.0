import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaMap, FaCompass, FaStar, FaSkull, FaBrain } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { startDiagnosticTest } from '../../api/Student/Diagnostic';
import '../../styles/Student/DiagnosticIntro.css';

const SUBJECT_ICONS = {
  'Matematika': FaBrain,
  'Magyar': FaCompass,
  'Angol': FaStar,
  'Környezetismeret': FaMap
};

const SUBJECT_COLORS = {
  'Matematika': '#3498db',
  'Magyar': '#e74c3c',
  'Angol': '#2ecc71',
  'Környezetismeret': '#9b59b6'
};

const SUBJECT_STORIES = {
  'Matematika': {
    title: 'A Számok Birodalma',
    description: 'Üdvözöllek a számok és alakzatok varázslatos világában! 🏰\n\nEzen a kalandon keresztül felfedezheted az algebra titkait, a geometria csodáit, és még sok más izgalmas matematikai kaland vár rád.',
    icon: '🧮'
  },
  'Magyar': {
    title: 'A Szavak Varázsvilága',
    description: 'Lépj be a nyelv és az irodalom mesés birodalmába! 📚\n\nFedezd fel a helyesírás titkait, merülj el a költészet világában, és válj igazi szövegértés mesteré!',
    icon: '📖'
  },
  'Angol': {
    title: 'The English Adventure',
    description: 'Welcome to the exciting world of English! 🌍\n\nExplore grammar mysteries, build your vocabulary treasure, and become a confident English communicator!',
    icon: '🗣️'
  },
  'Környezetismeret': {
    title: 'A Természet Titkai',
    description: 'Kalandra hív a természet világa! 🌿\n\nFedezd fel a földrajz csodáit, a biológia titkait, és értsd meg a környezetünk működését!',
    icon: '🌍'
  }
};

const DiagnosticIntro = () => {
  const { subject } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const subjectData = SUBJECT_STORIES[subject] || SUBJECT_STORIES['Matematika'];
  const subjectColor = SUBJECT_COLORS[subject] || '#3498db';
  const IconComponent = SUBJECT_ICONS[subject] || FaBrain;

  useEffect(() => {
    // Ellenőrizd, hogy érvényes tantárgy-e
    if (!SUBJECT_STORIES[subject]) {
      navigate('/adaptiv-terkep');
    }
  }, [subject, navigate]);

  const handleStartAdventure = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Indítsd el a diagnosztikai tesztet
      const testData = await startDiagnosticTest(subject);
      console.log('[DiagnosticIntro] Test started:', testData);
      
      // Navigálj a teszt oldalra a teszt adataival
      navigate(`/diagnosztika/${subject}/teszt`, { 
        state: { 
          testId: testData.testId,
          questions: testData.questions,
          totalQuestions: testData.totalQuestions
        } 
      });
    } catch (err) {
      console.error('[DiagnosticIntro] Error starting test:', err);
      setError(err.message || 'Hiba történt a teszt indításakor');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div id="content">
        <div className="loading-container">
          <LoadingSpinner />
          <p className="loading-text">A kaland készülődik...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="content">
      <div className="diagnostic-intro-container">
        {/* Animated Background Elements */}
        <div className="floating-elements">
          <div className="float-item" style={{ left: '10%', animationDelay: '0s' }}>⭐</div>
          <div className="float-item" style={{ left: '25%', animationDelay: '1s' }}>🌟</div>
          <div className="float-item" style={{ left: '40%', animationDelay: '2s' }}>✨</div>
          <div className="float-item" style={{ left: '55%', animationDelay: '0.5s' }}>💫</div>
          <div className="float-item" style={{ left: '70%', animationDelay: '1.5s' }}>⭐</div>
          <div className="float-item" style={{ left: '85%', animationDelay: '2.5s' }}>🌟</div>
        </div>

        {/* Main Content */}
        <div className="intro-card">
          <div className="intro-header">
            <div className="subject-icon-wrapper" style={{ backgroundColor: `${subjectColor}20` }}>
              <span className="subject-emoji">{subjectData.icon}</span>
              <IconComponent className="subject-icon" style={{ color: subjectColor }} />
            </div>
            <h1 className="intro-title">🗺️ A Kaland Kezdete</h1>
            <h2 className="subject-title" style={{ color: subjectColor }}>
              {subjectData.title}
            </h2>
          </div>

          <div className="intro-body">
            <div className="story-text">
              {subjectData.description.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>

            <div className="test-info">
              <div className="info-item">
                <FaMap className="info-icon" />
                <div className="info-content">
                  <strong>Hossz:</strong>
                  <span>20 kérdés</span>
                </div>
              </div>
              <div className="info-item">
                <FaCompass className="info-icon" />
                <div className="info-content">
                  <strong>Típus:</strong>
                  <span>Szintfelmérő</span>
                </div>
              </div>
              <div className="info-item">
                <FaSkull className="info-icon" />
                <div className="info-content">
                  <strong>Nehézség:</strong>
                  <span>Változó</span>
                </div>
              </div>
            </div>

            <div className="important-note">
              <div className="note-icon">📋</div>
              <div className="note-content">
                <strong>Fontos tudnivalók:</strong>
                <ul>
                  <li>Ez egy szintfelmérő teszt – nincs azonnali visszajelzés</li>
                  <li>A válaszaid alapján személyre szabott tanulási útvonalat kapsz</li>
                  <li>Ne aggódj a hibák miatt – ezek segítenek a fejlődésben!</li>
                  <li>Vedd be a saját idődben, de próbáld meg őszintén kitölteni</li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="intro-footer">
            <button 
              className="btn-start-adventure"
              onClick={handleStartAdventure}
              style={{ backgroundColor: subjectColor }}
            >
              <FaMap className="btn-icon" />
              Kezdés! 🚀
            </button>
            
            <button 
              className="btn-back"
              onClick={() => navigate('/adaptiv-terkep')}
            >
              Vissza a térképre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticIntro;