import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaBook, FaStar, FaFire } from 'react-icons/fa';
import '../../styles/Student/SubjectSelectPage.css';

const SubjectSelectPage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalXP: 0, streak: 0 });

  const subjectList = [
    { name: 'Matematika', icon: '🔢', subject: 'Matematika' },
    { name: 'Magyar', icon: '📖', subject: 'Magyar' },
    { name: 'Angol', icon: '🌍', subject: 'Angol' },
    { name: 'Környezetismeret', icon: '🌱', subject: 'Környezetismeret' }
  ];

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    try {
      const token = sessionStorage.getItem('AccessToken');
      // Fetch student progress for all subjects
      const response = await fetch('/api/student/progress', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.progress) {
          setSubjects(data.progress);
          setStats({ totalXP: data.totalXP || 0, streak: data.streak || 0 });
        }
      } else {
        console.error('Nem sikerült a progress adatok lekérése');
      }
    } catch (err) {
      console.error('Hiba a progress adatok betöltésekor:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSubjectStatus = (subjectName) => {
    const found = subjects.find(s => s.subject === subjectName);
    if (!found) return { status: 'not_started', percentage: 0, level: 'Kezdő' };
    return {
      status: found.status || 'not_started',
      percentage: found.percentage || 0,
      level: found.currentLevel || 'Kezdő'
    };
  };

  const handleSubjectClick = (subject) => {
    navigate(`/egyeni-gyakorlas/${subject}`);
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
    <div className="subject-select-page">
      <div className="subject-header">
        <h1>📚 Egyéni Gyakorlás</h1>
        <div className="stats-bar">
          <div className="stat">
            <FaStar className="stat-icon" />
            <span>{stats.totalXP} XP</span>
          </div>
          <div className="stat">
            <FaFire className="stat-icon" />
            <span>{stats.streak} nap</span>
          </div>
        </div>
      </div>

      <div className="subject-grid">
        {subjectList.map((subj) => {
          const status = getSubjectStatus(subj.subject);
          const statusTexts = {
            'not_started': 'Kezdő',
            'requires_diagnostic': 'Felmérő',
            'in_progress': `Szint: ${status.level}`,
            'level_complete': 'Befejezve'
          };

          return (
            <div
              key={subj.subject}
              className={`subject-card ${status.status}`}
              onClick={() => handleSubjectClick(subj.subject)}
            >
              <div className="subject-icon">{subj.icon}</div>
              <h3>{subj.name}</h3>
              <div className="subject-status">
                <span className="status-label">{statusTexts[status.status]}</span>
              </div>
              {status.percentage > 0 && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${status.percentage}%` }} />
                </div>
              )}
              {status.status === 'not_started' && <span className="cta">Kattints itt</span>}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
};

export default SubjectSelectPage;
