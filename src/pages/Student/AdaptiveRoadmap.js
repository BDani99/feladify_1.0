import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRoadmap, submitRoadmapNode } from '../../api/Student/Roadmap';
import { getAllDiagnosticStatuses } from '../../api/Student/Diagnostic';
import LoadingSpinner from '../../components/LoadingSpinner';
import TutorPracticeModal from './TutorPracticeModal';
import { FaTrophy, FaFire, FaStar, FaLock, FaCheck, FaPlay, FaMap, FaPlus } from 'react-icons/fa';
import '../../styles/Student/AdaptiveRoadmap.css';

const SUBJECT_COLORS = {
  'Matematika': '#3498db',
  'Magyar': '#e74c3c',
  'Angol': '#2ecc71',
  'Természetismeret': '#9b59b6'
};

const AdaptiveRoadmap = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roadmapData, setRoadmapData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const [showBadgeNotification, setShowBadgeNotification] = useState(false);
  const [diagnosticStatuses, setDiagnosticStatuses] = useState({});
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('studentSettings')) || {};
    } catch {
      return {};
    }
  });
  const svgRef = useRef(null);

  useEffect(() => {
    loadRoadmap();
    loadDiagnosticStatuses();
  }, []);

  useEffect(() => {
    if (newBadges.length > 0) {
      setShowBadgeNotification(true);
      const timer = setTimeout(() => {
        setShowBadgeNotification(false);
        setNewBadges([]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newBadges]);

  const loadRoadmap = async () => {
    console.log('[AdaptiveRoadmap] Loading roadmap...');
    try {
      const data = await fetchRoadmap();
      console.log('[AdaptiveRoadmap] Roadmap loaded:', data);
      setRoadmapData(data);
    } catch (err) {
      console.error('[AdaptiveRoadmap] Error loading roadmap:', err);
      setError(err.message || 'Ismeretlen hiba történt az útvonal betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const loadDiagnosticStatuses = async () => {
    try {
      const statuses = await getAllDiagnosticStatuses();
      setDiagnosticStatuses(statuses);
    } catch (err) {
      console.error('[AdaptiveRoadmap] Error loading diagnostic statuses:', err);
    }
  };

  const handleStartDiagnostic = (subject) => {
    navigate(`/diagnosztika/${subject}`);
  };

  const handleNodeClick = (node) => {
    if (node.status === 'unlocked') {
      setSelectedNode(node);
      setShowModal(true);
    }
  };

  const handleSubmitNode = async (score) => {
    if (!selectedNode) return;

    setSubmitting(true);
    try {
      const result = await submitRoadmapNode(selectedNode.nodeId, score);
      
      // Update roadmap data
      setRoadmapData(prev => ({
        ...prev,
        totalXP: result.totalXP,
        streak: result.streak
      }));

      // Show new badges if any
      if (result.newBadges && result.newBadges.length > 0) {
        setNewBadges(result.newBadges);
      }

      // Refresh roadmap
      await loadRoadmap();
      setShowModal(false);
      setSelectedNode(null);
    } catch (err) {
      alert('Hiba történt a beküldéskor: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getNodePosition = (index, totalNodes) => {
    // Calculate position in a winding path
    const row = Math.floor(index / 4);
    const col = index % 4;
    const xOffset = row % 2 === 0 ? col : (3 - col);
    const x = 100 + xOffset * 120;
    const y = 80 + row * 100;
    return { x, y };
  };

  const renderSVGConnections = () => {
    if (!roadmapData || !svgRef.current) return null;

    const nodes = roadmapData.roadmap;
    const connections = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const current = nodes[i];
      const next = nodes[i + 1];
      
      // Only connect nodes in the same subject group or consecutive subjects
      const currentPos = getNodePosition(i, nodes.length);
      const nextPos = getNodePosition(i + 1, nodes.length);

      const isCompleted = current.status === 'completed';
      const isUnlocked = next.status === 'unlocked' || isCompleted;

      connections.push(
        <path
          key={`conn-${i}`}
          d={`M ${currentPos.x} ${currentPos.y + 30} Q ${(currentPos.x + nextPos.x) / 2} ${(currentPos.y + nextPos.y) / 2 + 20} ${nextPos.x} ${nextPos.y + 30}`}
          fill="none"
          stroke={isUnlocked ? (isCompleted ? '#2ecc71' : '#f39c12') : '#bdc3c7'}
          strokeWidth="3"
          strokeDasharray={isUnlocked ? 'none' : '5,5'}
          className="roadmap-connection"
        />
      );
    }

    return connections;
  };

  const renderNodes = () => {
    if (!roadmapData) return null;

    return roadmapData.roadmap.map((node, index) => {
      const pos = getNodePosition(index, roadmapData.roadmap.length);
      const color = SUBJECT_COLORS[node.subject] || '#95a5a6';
      const isCompleted = node.status === 'completed';
      const isUnlocked = node.status === 'unlocked';
      const isLocked = node.status === 'locked';

      return (
        <div
          key={node.nodeId}
          className={`roadmap-node ${node.status} ${node.isExtraPractice ? 'extra-practice' : ''}`}
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            borderColor: color,
            backgroundColor: isCompleted ? color : (isUnlocked ? `${color}40` : '#ecf0f1')
          }}
          onClick={() => handleNodeClick(node)}
          title={`${node.subject}: ${node.topic}`}
        >
          <div className="node-icon">
            {isCompleted ? (
              <FaCheck className="completed-icon" />
            ) : isUnlocked ? (
              <FaPlay className="unlocked-icon" />
            ) : (
              <FaLock className="locked-icon" />
            )}
          </div>
          
          {node.score > 0 && (
            <div className="node-score">{node.score}%</div>
          )}
          
          <div className="node-tooltip">
            <strong>{node.subject}</strong>
            <span>{node.topic}</span>
            {node.isExtraPractice && <span className="extra-badge">Extra gyakorlás</span>}
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div id="content">
        <div className="error-message">
          <h2>⚠️ Hiba történt</h2>
          <p>{error}</p>
          <p className="error-details">
            Kérjük, ellenőrizd, hogy a backend szerver fut, és be vagy jelentkezve.
          </p>
          <button onClick={loadRoadmap} className="retry-button">Újrapróbálkozás</button>
        </div>
      </div>
    );
  }

  return (
    <div id="content">
      <div className="adaptive-roadmap-container">
        {/* Gamification Header */}
        <div className="gamification-header">
          <div className="xp-container">
            <div className="xp-icon"><FaStar /></div>
            <div className="xp-info">
              <span className="xp-label">XP</span>
              <span className="xp-value">{roadmapData?.totalXP || 0}</span>
            </div>
            <div className="xp-bar">
              <div 
                className="xp-progress" 
                style={{ width: `${Math.min((roadmapData?.totalXP % 1000) / 10, 100)}%` }}
              />
            </div>
          </div>

          <div className="streak-container">
            <div className="streak-icon"><FaFire /></div>
            <div className="streak-info">
              <span className="streak-value">{roadmapData?.streak || 0}</span>
              <span className="streak-label">nap</span>
            </div>
          </div>

          <div className="badges-container">
            {roadmapData?.badges?.slice(0, 5).map((badge, index) => (
              <div key={index} className="badge-icon" title={badge.description}>
                {badge.icon}
              </div>
            ))}
            {roadmapData?.badges?.length > 5 && (
              <div className="badge-more">+{roadmapData.badges.length - 5}</div>
            )}
          </div>
        </div>

        {/* Badge Notification */}
        {showBadgeNotification && (
          <div className="badge-notification">
            <FaTrophy className="notification-icon" />
            <div className="notification-content">
              <h4>Új kitűzők!</h4>
              {newBadges.map((badge, index) => (
                <div key={index} className="notification-badge">
                  <span>{badge.icon}</span>
                  <span>{badge.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roadmap Visualization */}
        <div className="roadmap-visualization">
          <svg ref={svgRef} className="roadmap-svg">
            {renderSVGConnections()}
          </svg>
          <div className="roadmap-nodes">
            {renderNodes()}
          </div>
        </div>

        {/* Subject Legend */}
        <div className="subject-legend">
          {Object.entries(SUBJECT_COLORS).map(([subject, color]) => (
            <div key={subject} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: color }} />
              <span>{subject}</span>
            </div>
          ))}
        </div>

        {/* Node Interaction Modal – TutorPracticeModal */}
        {showModal && selectedNode && (
          <TutorPracticeModal
            node={selectedNode}
            aiTone={settings.aiTone || 'teacher'}
            hintLevel={settings.hintLevel || 'normal'}
            onClose={() => {
              setShowModal(false);
              setSelectedNode(null);
            }}
            onComplete={(score) => {
              setShowModal(false);
              handleSubmitNode(score);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AdaptiveRoadmap;