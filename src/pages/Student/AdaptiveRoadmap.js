import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPracticePath } from '../../api/Student/Roadmap';
import { getAllDiagnosticStatuses } from '../../api/Student/Diagnostic';
import LoadingSpinner from '../../components/LoadingSpinner';
import TutorPracticeModal from './TutorPracticeModal';
import { FaTrophy, FaLock, FaCheck, FaPlay, FaGraduationCap, FaBrain } from 'react-icons/fa';
import '../../styles/Student/AdaptiveRoadmap.css';

const SUBJECTS = [
  { name: 'Matematika', icon: '📐', description: 'Számok, algebra, geometria és logika' },
  { name: 'Magyar', icon: '📚', description: 'Nyelvtan, irodalom és szövegértés' },
  { name: 'Angol', icon: '🌍', description: 'Szókincs, nyelvtan és kommunikáció' },
  { name: 'Környezetismeret', icon: '🌱', description: 'Természet és minket körülvevő világ' }
];

const AdaptiveRoadmap = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subjectStatuses, setSubjectStatuses] = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [practiceData, setPracticeData] = useState(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const [showBadgeNotification, setShowBadgeNotification] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    loadStatuses();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadPracticePath(selectedSubject);
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (newBadges.length > 0) {
      setShowBadgeNotification(true);
      const timer = setTimeout(() => {
        setShowBadgeNotification(false);
        setNewBadges([]);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [newBadges]);

  const loadStatuses = async () => {
    try {
      setLoading(true);
      // Itt lekérjük, hogy melyik tárgyból tart hol a diák (van-e már szintfelmérője)
      const statuses = await getAllDiagnosticStatuses();
      setSubjectStatuses(statuses || {});
    } catch (err) {
      console.error('[EgyeniGyakorlas] Hiba a státuszok betöltésekor:', err);
      // Fallback üres objektum, hogy ne omoljon össze
      setSubjectStatuses({}); 
    } finally {
      setLoading(false);
    }
  };

  const loadPracticePath = async (subject) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPracticePath(subject);
      setPracticeData(data);
    } catch (err) {
      console.error('[EgyeniGyakorlas] Hiba a gyakorlóút betöltésekor:', err);
      // Itt most már a tényleges hibaüzenetet jelenítjük meg, amit a fetch vagy a backend dob!
      setError(`Nem sikerült betölteni a feladatsort. Részletek: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (subject) => {
    setSelectedSubject(subject);
    setPracticeData(null);
    setError(null);
  };

  const handleStartDiagnostic = (subject) => {
    navigate(`/diagnosztika/${subject}`);
  };

  const handleCheckpointClick = (checkpoint) => {
    if (checkpoint.status === 'unlocked' || checkpoint.status === 'completed') {
      setSelectedCheckpoint(checkpoint);
      setShowModal(true);
    }
  };

  const handlePracticeComplete = (result) => {
    setShowModal(false);
    setSelectedCheckpoint(null);
    
    // Frissítjük a lokális adatokat a backend válasza alapján
    if (result && result.subjectProgress) {
      setPracticeData(result.subjectProgress);
    } else {
      // Újratöltjük az útvonalat, ha nincs közvetlen válasz adat
      loadPracticePath(selectedSubject);
    }

    if (result && result.newBadges && result.newBadges.length > 0) {
      setNewBadges(result.newBadges);
    }
  };

  const getNodePosition = (index, totalNodes) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const xOffset = row % 2 === 0 ? col : (2 - col);
    const x = 150 + xOffset * 180;
    const y = 100 + row * 140;
    return { x, y };
  };

  const renderSVGConnections = () => {
    if (!practiceData || !practiceData.checkpoints || !svgRef.current) return null;
    const nodes = practiceData.checkpoints;
    const connections = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      const currentPos = getNodePosition(i, nodes.length);
      const nextPos = getNodePosition(i + 1, nodes.length);
      const isCompleted = current.status === 'completed';
      const isUnlocked = next.status === 'unlocked' || next.status === 'completed';

      connections.push(
        <path
          key={`conn-${i}`}
          d={`M ${currentPos.x} ${currentPos.y} Q ${(currentPos.x + nextPos.x) / 2} ${(currentPos.y + nextPos.y) / 2} ${nextPos.x} ${nextPos.y}`}
          fill="none"
          stroke={isUnlocked ? (isCompleted ? 'var(--accent)' : '#f39c12') : 'var(--border-color)'}
          strokeWidth="4"
          strokeDasharray={isUnlocked ? 'none' : '8,8'}
          className="roadmap-connection"
        />
      );
    }

    return connections;
  };

  const renderNodes = () => {
    if (!practiceData || !practiceData.checkpoints) return null;

    return practiceData.checkpoints.map((checkpoint, index) => {
      const pos = getNodePosition(index, practiceData.checkpoints.length);
      const isCompleted = checkpoint.status === 'completed';
      const isUnlocked = checkpoint.status === 'unlocked';

      return (
        <div
          key={checkpoint.checkpointId}
          className={`roadmap-node ${checkpoint.status}`}
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
          }}
          onClick={() => handleCheckpointClick(checkpoint)}
        >
          <div className="node-icon-wrapper">
            {isCompleted ? (
              <FaCheck className="node-icon completed-icon" />
            ) : isUnlocked ? (
              <FaPlay className="node-icon unlocked-icon" />
            ) : (
              <FaLock className="node-icon locked-icon" />
            )}
          </div>
          
          <div className="node-difficulty">Nehézség: {checkpoint.difficulty}/5</div>

          <div className="node-tooltip">
            <strong>{checkpoint.topic || 'Gyakorlás'}</strong>
            <span>{isCompleted ? 'Teljesítve' : isUnlocked ? 'Készen áll' : 'Zárolva'}</span>
          </div>
        </div>
      );
    });
  };

  if (loading && !practiceData) {
    return (
      <div id="content" className="flex-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div id="content">
      <div className="practice-container">
        <div className="page-header">
          <h1>Egyéni Gyakorlás</h1>
          <p>Válassz tantárgyat, töltsd ki a szintfelmérőt, majd oldd meg az AI által generált kihívásokat!</p>
        </div>

        <div className="subject-grid">
          {SUBJECTS.map(subject => {
            const statusInfo = subjectStatuses[subject.name] || { status: 'not_started' };
            const isActive = selectedSubject === subject.name;
            
            return (
              <div
                key={subject.name}
                className={`subject-card ${isActive ? 'active' : ''}`}
                onClick={() => handleSubjectSelect(subject.name)}
              >
                <div className="subject-icon">{subject.icon}</div>
                <div className="subject-info">
                  <h3>{subject.name}</h3>
                  <p>{subject.description}</p>
                </div>
                <div className={`status-badge ${statusInfo.status}`}>
                  {statusInfo.status === 'completed' ? 'Készen áll' : statusInfo.status === 'in_progress' ? 'Folyamatban' : 'Új'}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {selectedSubject && (
          <div className="roadmap-section">
            {!practiceData && loading ? (
              <div className="loading-panel"><LoadingSpinner /></div>
            ) : practiceData ? (
              <div className="practice-panel">
                <div className="panel-header">
                  <h2>{selectedSubject} - Jelenlegi Szint</h2>
                  <div className="progress-stats">
                    <span><FaCheck /> {practiceData.checkpoints?.filter(c => c.status === 'completed').length || 0} Megoldva</span>
                    <span><FaBrain /> {practiceData.checkpoints?.length || 0} Küldetés</span>
                  </div>
                </div>

                {practiceData.status === 'requires_diagnostic' && (
                  <div className="action-banner">
                    <div className="banner-content">
                      <h3>Szintfelmérő Szükséges!</h3>
                      <p>Mielőtt megkapod a személyre szabott feladataidat, kérjük töltsd ki a szintfelmérőt, hogy tudjuk, honnan induljunk.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleStartDiagnostic(selectedSubject)}>
                      <FaGraduationCap /> Szintfelmérő Indítása
                    </button>
                  </div>
                )}

                {practiceData.status === 'level_complete' && (
                  <div className="action-banner success">
                    <div className="banner-content">
                      <h3>Szint Teljesítve! Gratulálunk! 🎉</h3>
                      <p>Minden feladatot megoldottál ezen a szinten. Indítsd el az új szintfelmérőt a következő kihívásokhoz!</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleStartDiagnostic(selectedSubject)}>
                      <FaGraduationCap /> Új Szintfelmérő
                    </button>
                  </div>
                )}

                {(practiceData.status === 'in_progress' || practiceData.status === 'level_complete') && (
                  <div className="roadmap-visualization">
                    <svg ref={svgRef} className="roadmap-svg">
                      {renderSVGConnections()}
                    </svg>
                    <div className="roadmap-nodes">
                      {renderNodes()}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Badge Notification Modal */}
        {showBadgeNotification && (
          <div className="badge-notification">
            <FaTrophy className="notification-icon" />
            <div className="notification-content">
              <h4>Új kitűzőt szereztél!</h4>
              {newBadges.map((badge, index) => (
                <div key={index} className="notification-badge">
                  <span>{badge.icon}</span>
                  <span>{badge.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Practice Modal */}
        {showModal && selectedCheckpoint && (
          <TutorPracticeModal
            checkpoint={selectedCheckpoint}
            subject={selectedSubject}
            onClose={() => {
              setShowModal(false);
              setSelectedCheckpoint(null);
            }}
            onComplete={handlePracticeComplete}
          />
        )}
      </div>
    </div>
  );
};

export default AdaptiveRoadmap;