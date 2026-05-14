import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../api/config';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaBook } from 'react-icons/fa';
import '../../styles/Student/PracticeHub.css';

const PracticeHub = () => {
  const { subject } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const [status, setStatus] = useState('not_started');
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState(user?.className || '4. osztály');
  const [roadmapExists, setRoadmapExists] = useState(false);

  useEffect(() => {
    fetchSubjectStatus();
  }, [subject]);

  const fetchSubjectStatus = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/student/progress/${subject}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const currentStatus = data.status || 'not_started';
        const hasRoadmap = data.checkpoints && data.checkpoints.length > 0;
        setStatus(currentStatus);
        setRoadmapExists(hasRoadmap);
        // Ha már van roadmap, rögtön oda navigálunk
        if (hasRoadmap) {
          navigate(`/egyeni-gyakorlas/${subject}/roadmap`);
          return;
        }
      }
    } catch (err) {
      console.error('Hiba a status lekéréskor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDiagnostic = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/student/diagnostic/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject, grade: selectedGrade })
      });
      if (response.ok) {
        const data = await response.json();
        navigate(`/egyeni-gyakorlas/${subject}/teszt`, { state: { testId: data.testId, questions: data.questions } });
      } else {
        const errorData = await response.json();
        console.error('Backend hiba:', response.status, errorData);
        alert(`Hiba: ${errorData.message || 'Ismeretlen hiba'}`);
      }
    } catch (err) {
      console.error('Hiba a szintfelmérő indításakor:', err);
      alert('Hiba: ' + err.message);
    }
  };

  const handleViewRoadmap = () => {
    navigate(`/egyeni-gyakorlas/${subject}/roadmap`);
  };

  if (loading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  const needsDiagnostic = status === 'not_started' || status === 'requires_diagnostic';

  return (
    <div id="content">
    <div className="practice-hub">
      <div className="page-top-bar">
        <button className="back-btn" onClick={() => navigate('/egyeni-gyakorlas')}>
          <FaArrowLeft /> Vissza
        </button>
      </div>

      <div className="hub-container">
        {needsDiagnostic ? (
          <div className="diagnostic-section">
            <div className="diagnostic-header">
              <FaBook className="book-icon" />
              <h1>{subject} Szintfelmérő</h1>
            </div>

            <div className="diagnostic-content">
              <p className="intro-text">
                Mielőtt elkezded a gyakorlást, mérjük fel a tudásod!
                A szintfelmérő alapján személyre szabott tanulási utat készítünk számodra.
              </p>

              <div className="grade-selector">
                <label htmlFor="grade">Osztályfok:</label>
                <select
                  id="grade"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                >
                  <option>1. osztály</option>
                  <option>2. osztály</option>
                  <option>3. osztály</option>
                  <option>4. osztály</option>
                  <option>5. osztály</option>
                  <option>6. osztály</option>
                  <option>7. osztály</option>
                  <option>8. osztály</option>
                </select>
              </div>

              <div className="test-info">
                <div className="info-item">
                  <span className="info-icon">📋</span>
                  <span>~20 kérdés</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">⏱️</span>
                  <span>~15 perc</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">🎯</span>
                  <span>Min. 6 kérdéstípus</span>
                </div>
              </div>

              <button className="start-btn" onClick={handleStartDiagnostic}>
                Szintfelmérő indítása
              </button>
            </div>
          </div>
        ) : (
          <div className="roadmap-section">
            <h1>{subject} Tanulási Út</h1>
            <p>Készen állsz a tanulásra! Nézd meg a személyre szabott roadmapot.</p>
            <button className="view-roadmap-btn" onClick={handleViewRoadmap}>
              Roadmap megtekintése
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default PracticeHub;
