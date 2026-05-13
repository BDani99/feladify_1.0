import React, { useState, useEffect } from 'react';
import { fetchStudentStatistics } from '../../api/Student/Roadmap';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  RadialLinearScale
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';
import { FaStar, FaFire, FaTrophy, FaChartLine, FaBrain, FaExclamationCircle } from 'react-icons/fa';
import '../../styles/Student/StudentStatistics.css';

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  RadialLinearScale
);

const StudentStatistics = () => {
  const [statistics, setStatistics] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatistics = async () => {
    try {
      const data = await fetchStudentStatistics();
      setStatistics(data);
    } catch (error) {
      console.error('[StudentStatistics] Error loading statistics:', error);
      setError(error.message || 'A statisztikák betöltése nem sikerült. Kérjük, próbáld újra.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  if (isLoading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div id="content">
        <p className="error-message">
          <FaExclamationCircle />{error}
        </p>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  // Gamification stats
  const { totalXP, streak, badges, averageScore, completedAssignments, totalAssignments } = statistics;

  // Radar chart for topic-level breakdown
  const radarChartData = {
    labels: statistics.topicStats?.map(stat => stat.topic) || [],
    datasets: [
      {
        label: 'Teljesítmény (%)',
        data: statistics.topicStats?.map(stat => stat.averageScore) || [],
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        borderColor: 'rgba(52, 152, 219, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(52, 152, 219, 1)',
      }
    ]
  };

  // Line chart for performance over time
  const lineChartData = {
    labels: statistics.assignmentsStatistics?.map((_, index) => `${index + 1}.`) || [],
    datasets: [
      {
        label: 'Pontszám (%)',
        data: statistics.assignmentsStatistics?.map(stat => 
          stat.totalPoints > 0 ? (stat.achievedPoints / stat.totalPoints) * 100 : 0
        ) || [],
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Strengths and weaknesses
  const strengths = statistics.strengths || [];
  const weaknesses = statistics.weaknesses || [];

  return (
    <div id="content">
      <div className="student-statistics-container">
        <h1 className="stat-title">Statisztikák és Elemzések</h1>

        {/* Gamification Header */}
        <div className="stats-gamification-header">
          <div className="stat-card xp-card">
            <FaStar className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">{totalXP}</span>
              <span className="stat-label">Összes XP</span>
            </div>
          </div>

          <div className="stat-card streak-card">
            <FaFire className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">{streak}</span>
              <span className="stat-label">Napi Streak</span>
            </div>
          </div>

          <div className="stat-card badges-card">
            <FaTrophy className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">{badges.length}</span>
              <span className="stat-label">Kitűzők</span>
            </div>
          </div>

          <div className="stat-card score-card">
            <FaChartLine className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">{averageScore}%</span>
              <span className="stat-label">Átlag Pontszám</span>
            </div>
          </div>
        </div>

        {/* Badges Section */}
        {badges.length > 0 && (
          <div className="badges-section">
            <h2>🏆 Kitűzők</h2>
            <div className="badges-grid">
              {badges.map((badge, index) => (
                <div key={index} className="badge-card" title={badge.description}>
                  <span className="badge-emoji">{badge.icon}</span>
                  <span className="badge-name">{badge.name}</span>
                  <span className="badge-desc">{badge.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="stats-grid">
          {/* Topic Performance Radar Chart */}
          <div className="stat-card large">
            <h3>Témakör Szintű Teljesítmény</h3>
            <div className="chart-container">
              {statistics.topicStats && statistics.topicStats.length > 0 ? (
                <Radar data={radarChartData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: 100
                    }
                  }
                }} />
              ) : (
                <div className="no-data">Még nincs elegendő adat. Oldj meg néhány feladatot!</div>
              )}
            </div>
          </div>

          {/* Performance Over Time */}
          <div className="stat-card large">
            <h3>Teljesítmény Időbeli Alakulása</h3>
            <div className="chart-container">
              {statistics.assignmentsStatistics && statistics.assignmentsStatistics.length > 0 ? (
                <Line data={lineChartData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100
                    }
                  }
                }} />
              ) : (
                <div className="no-data">Még nincs elegendő adat. Oldj meg néhány feladatot!</div>
              )}
            </div>
          </div>

          {/* Strengths */}
          <div className="stat-card">
            <h3>💪 Erősségeid</h3>
            <div className="strengths-weaknesses">
              {strengths.length > 0 ? (
                strengths.map((item, index) => (
                  <div key={index} className="sw-item strength">
                    <span className="sw-topic">{item.topic}</span>
                    <div className="sw-bar-container">
                      <div 
                        className="sw-bar" 
                        style={{ width: `${item.averageScore}%` }}
                      />
                    </div>
                    <span className="sw-score">{item.averageScore}%</span>
                  </div>
                ))
              ) : (
                <div className="no-data">Még nincs adat</div>
              )}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="stat-card">
            <h3>📚 Fejlesztendő Területek</h3>
            <div className="strengths-weaknesses">
              {weaknesses.length > 0 ? (
                weaknesses.map((item, index) => (
                  <div key={index} className="sw-item weakness">
                    <span className="sw-topic">{item.topic}</span>
                    <div className="sw-bar-container">
                      <div 
                        className="sw-bar" 
                        style={{ width: `${item.averageScore}%` }}
                      />
                    </div>
                    <span className="sw-score">{item.averageScore}%</span>
                  </div>
                ))
              ) : (
                <div className="no-data">Még nincs adat</div>
              )}
            </div>
          </div>
        </div>

        {/* AI Analysis Section */}
        <div className="ai-analysis-section">
          <div className="ai-analysis-header">
            <FaBrain className="ai-icon" />
            <h2>Az AI Tanárod Elemzése</h2>
          </div>
          <div className="ai-analysis-content">
            <p>
              {averageScore >= 80 ? (
                <>
                  🎉 <strong>Gratulálok!</strong> Kiváló teljesítményt nyújtasz! 
                  Az átlagos pontszámod <strong>{averageScore}%</strong>, ami kiemelkedő. 
                  Folytasd így, és érdemes lehet nehezebb kihívásokat is vállalnod!
                </>
              ) : averageScore >= 60 ? (
                <>
                  👍 <strong>Jó munkát végzel!</strong> Az átlagos pontszámod <strong>{averageScore}%</strong>. 
                  {weaknesses.length > 0 && ` Érdemes több figyelmet fordítanod a "${weaknesses[0]?.topic}" témakörre, 
                  ahol még van fejlődési lehetőség.`}
                  <br/><br/>
                  💡 <strong>Tipp:</strong> Használd az AI Tanár chatet, hogy segítsen a gyengébb területek fejlesztésében!
                </>
              ) : (
                <>
                  💪 <strong>Ne add fel!</strong> Mindenki így kezdte. 
                  Az átlagos pontszámod jelenleg <strong>{averageScore}%</strong>, 
                  de ez csak egy szám – a fontos, hogy fejlődj!
                  <br/><br/>
                  🎯 <strong>Javaslat:</strong> Kezdd az alapokkal, és használd az AI Tanár segítségét. 
                  Napi 15 perc gyakorlással már egy hét alatt is javulhatsz!
                </>
              )}
            </p>
            
            {streak > 0 && (
              <div className="streak-motivation">
                🔥 <strong>{streak} napos streak!</strong> 
                {streak >= 7 ? ' Egy hete folyamatosan tanulsz – ez fantasztikus!' : 
                 streak >= 3 ? ' Már 3 napja folyamatosan tanulsz – így tovább!' : 
                 ' Kezdesz belejönni a rendszeres tanulásba!'}
              </div>
            )}
          </div>
        </div>

        {/* Assignment Summary */}
        <div className="assignment-summary">
          <div className="summary-card">
            <h3>Összes Dolgozat</h3>
            <p className="summary-value">{totalAssignments}</p>
          </div>
          <div className="summary-card completed">
            <h3>Teljesített</h3>
            <p className="summary-value">{completedAssignments}</p>
          </div>
          <div className="summary-card pending">
            <h3>Várakozó</h3>
            <p className="summary-value">{totalAssignments - completedAssignments}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentStatistics;