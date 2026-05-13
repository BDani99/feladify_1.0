import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaArrowLeft, FaLock, FaPlay, FaCheck, FaTrophy } from 'react-icons/fa';
import '../../styles/Student/RoadmapView.css';

const RoadmapView = () => {
  const { subject } = useParams();
  const navigate = useNavigate();
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalXP: 0, progress: 0 });

  useEffect(() => {
    fetchRoadmap();
  }, [subject]);

  const fetchRoadmap = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      const response = await fetch(`/api/student/roadmap/${subject}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCheckpoints(data.checkpoints || []);
        const completed = (data.checkpoints || []).filter(cp => cp.status === 'completed').length;
        const progress = data.checkpoints ? (completed / data.checkpoints.length) * 100 : 0;
        setStats({ totalXP: data.totalXP || 0, progress });
      }
    } catch (err) {
      console.error('Hiba a roadmap lekérésekor:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCheckpoint = (checkpointId) => {
    navigate(`/egyeni-gyakorlas/${subject}/checkpoint/${checkpointId}`);
  };

  if (loading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div id="content">
    <div className="roadmap-view">
      <div className="page-top-bar">
        <button className="back-btn" onClick={() => navigate('/egyeni-gyakorlas')}>
          <FaArrowLeft /> Vissza
        </button>
      </div>

      <div className="roadmap-header">
        <h1>{subject} Tanulási Út</h1>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-label">XP:</span>
            <span className="stat-value">{stats.totalXP}</span>
          </div>
          <div className="progress-indicator">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${stats.progress}%` }} />
            </div>
            <span className="progress-text">{Math.round(stats.progress)}% kész</span>
          </div>
        </div>
      </div>

      <div className="checkpoints-list">
        {checkpoints.map((checkpoint, index) => (
          <div
            key={checkpoint.checkpointId}
            className={`checkpoint-card ${checkpoint.status}`}
            onClick={() => checkpoint.status === 'unlocked' && handleStartCheckpoint(checkpoint.checkpointId)}
          >
            <div className="checkpoint-icon">
              {checkpoint.status === 'completed' && <FaCheck />}
              {checkpoint.status === 'unlocked' && <FaPlay />}
              {checkpoint.status === 'locked' && <FaLock />}
            </div>

            <div className="checkpoint-content">
              <div className="checkpoint-number">
                {index + 1}. {checkpoint.topic}
              </div>

              <div className="checkpoint-meta">
                <span className="difficulty">
                  Nehézség: {checkpoint.difficulty}/5
                </span>
                {checkpoint.status === 'completed' && (
                  <span className="score">Pontszám: {checkpoint.score}%</span>
                )}
                {checkpoint.status === 'locked' && (
                  <span className="locked-msg">Zárolva – teljesítsd az előzőt</span>
                )}
              </div>
            </div>

            {checkpoint.status === 'unlocked' && (
              <button className="start-btn" onClick={(e) => { e.stopPropagation(); handleStartCheckpoint(checkpoint.checkpointId); }}>
                Megkezdés
              </button>
            )}

            {checkpoint.status === 'completed' && (
              <div className="completion-badge">
                <FaTrophy /> Teljesítve
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
    </div>
  );
};

export default RoadmapView;
