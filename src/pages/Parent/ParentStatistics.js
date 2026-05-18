import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import ParentChildSelector from '../../components/ParentChildSelector';
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  PointElement, LineElement,
  BarElement, ArcElement,
  CategoryScale, LinearScale,
  RadialLinearScale,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import {
  FaStar, FaFire, FaTrophy, FaChartBar,
  FaBrain, FaBook, FaCheckCircle, FaClock, FaExclamationCircle
} from 'react-icons/fa';
import '../../styles/Student/StudentStatistics.css';
import '../../styles/Parent/ParentGlobal.css';

ChartJS.register(
  Title, Tooltip, Legend, Filler,
  PointElement, LineElement, BarElement, ArcElement,
  CategoryScale, LinearScale, RadialLinearScale
);

const scoreColor = (v) => v >= 80 ? '#10b981' : v >= 60 ? '#3b82f6' : '#f59e0b';
const scoreGrad  = (v) => v >= 80
  ? 'linear-gradient(90deg,#10b981,#34d399)'
  : v >= 60
    ? 'linear-gradient(90deg,#3b82f6,#60a5fa)'
    : 'linear-gradient(90deg,#f59e0b,#fbbf24)';

/* ══════════════════════════════════════════════
   ASSIGNMENTS TAB
══════════════════════════════════════════════ */
const AssignmentTab = ({ data }) => {
  if (!data) return null;
  const {
    averageScore, completedAssignments, totalAssignments,
    assignmentsStatistics, strengths, weaknesses
  } = data;

  const hasAssignments = assignmentsStatistics && assignmentsStatistics.length > 0;
  const chartAssignments = assignmentsStatistics ? [...assignmentsStatistics].reverse() : [];

  const lineData = {
    labels: chartAssignments.map((_, i) => `${i + 1}.`),
    datasets: [{
      label: 'Pontszám (%)',
      data: chartAssignments.map(s =>
        s.totalPoints > 0 ? Math.round((s.achievedPoints / s.totalPoints) * 100) : 0
      ),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      tension: 0.4,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: '#3b82f6',
      borderWidth: 2.5
    }]
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw}%` } } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } }
    }
  };

  return (
    <>
      <div className="sts-cards-row">
        <div className="sts-card">
          <div className="sts-card-icon blue"><FaBook /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{totalAssignments}</div>
            <div className="sts-card-label">Összes dolgozat</div>
          </div>
        </div>
        <div className="sts-card">
          <div className="sts-card-icon green"><FaCheckCircle /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{completedAssignments}</div>
            <div className="sts-card-label">Értékelt</div>
          </div>
        </div>
        <div className="sts-card">
          <div className="sts-card-icon orange"><FaClock /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{totalAssignments - completedAssignments}</div>
            <div className="sts-card-label">Folyamatban</div>
          </div>
        </div>
        <div className="sts-card">
          <div className="sts-card-icon purple"><FaChartBar /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{averageScore}%</div>
            <div className="sts-card-label">Átlagos pontszám</div>
          </div>
        </div>
      </div>

      {hasAssignments ? (
        <>
          <div className="sts-section">
            <h2 className="sts-section-title">Pontszámok időbeli alakulása</h2>
            <div className="sts-chart-card">
              <div className="sts-chart-wrap">
                <Line data={lineData} options={lineOptions} />
              </div>
            </div>
          </div>

          <div className="sts-section">
            <h2 className="sts-section-title">Dolgozatok részletei</h2>
            <div className="sts-card-block">
              {assignmentsStatistics.map((a, i) => {
                const pct = a.totalPoints > 0 ? Math.round((a.achievedPoints / a.totalPoints) * 100) : 0;
                const gradeColors = { 5: '#3b82f6', 4: '#10b981', 3: '#f59e0b', 2: '#f97316', 1: '#ef4444' };
                return (
                  <div key={i} className="sts-assignment-row">
                    <span className="sts-assignment-num">{i + 1}.</span>
                    <div className="sts-assignment-info">
                      <span className="sts-assignment-title">{a.title || 'Dolgozat'}</span>
                      {a.subject && <span className="sts-assignment-subject">{a.subject}</span>}
                    </div>
                    <div className="sts-bar-track">
                      <div className="sts-bar-fill" style={{ width: `${pct}%`, background: scoreGrad(pct) }} />
                    </div>
                    <span className="sts-assignment-pts">{a.achievedPoints}/{a.totalPoints} pt</span>
                    <span className="sts-assignment-pct" style={{ color: scoreColor(pct) }}>{pct}%</span>
                    {a.grade != null ? (
                      <span className="sts-grade-badge" style={{ background: gradeColors[a.grade] + '22', color: gradeColors[a.grade], border: `1px solid ${gradeColors[a.grade]}44` }}>
                        {a.grade}
                      </span>
                    ) : (
                      <span className="sts-grade-badge pending">–</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {((strengths && strengths.length > 0) || (weaknesses && weaknesses.length > 0)) && (
            <div className="sts-two-col">
              {strengths && strengths.length > 0 && (
                <div className="sts-card-block">
                  <h3 className="sts-block-title">💪 Erős tantárgyak</h3>
                  {strengths.map((s, i) => (
                    <div key={i} className="sts-bar-row">
                      <span className="sts-bar-label">{s.topic}</span>
                      <div className="sts-bar-track">
                        <div className="sts-bar-fill" style={{ width: `${s.averageScore}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                      </div>
                      <span className="sts-bar-value" style={{ color: '#10b981' }}>{s.averageScore}%</span>
                    </div>
                  ))}
                </div>
              )}
              {weaknesses && weaknesses.length > 0 && (
                <div className="sts-card-block">
                  <h3 className="sts-block-title">📚 Fejleszthető területek</h3>
                  {weaknesses.map((w, i) => (
                    <div key={i} className="sts-bar-row">
                      <span className="sts-bar-label">{w.topic}</span>
                      <div className="sts-bar-track">
                        <div className="sts-bar-fill" style={{ width: `${w.averageScore}%`, background: 'linear-gradient(90deg,#ef4444,#f87171)' }} />
                      </div>
                      <span className="sts-bar-value" style={{ color: '#ef4444' }}>{w.averageScore}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="sts-empty">
          <div className="sts-empty-icon">📝</div>
          <h3>Gyermekednek még nincsenek értékelt dolgozatai</h3>
          <p>Amint a tanár kijavít egy dolgozatot, itt láthatod a részletes statisztikákat.</p>
        </div>
      )}
    </>
  );
};

/* ══════════════════════════════════════════════
   PRACTICE TAB
══════════════════════════════════════════════ */
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

const PracticeTab = ({ data }) => {
  if (!data) return null;
  const { totalXP, streak, badges, subjectStats, diagnosticBySubject, totalCheckpointsCompleted, overallAvgScore } = data;
  const xpLevel = Math.floor(totalXP / 50) + 1;
  const activeSubs = (subjectStats || []).filter(s => s.completedCheckpoints > 0);
  const allCheckpoints = activeSubs.flatMap(s => s.checkpointDetails);

  /* ── Doughnut: score distribution ── */
  const excellent = allCheckpoints.filter(c => c.score >= 80).length;
  const good      = allCheckpoints.filter(c => c.score >= 60 && c.score < 80).length;
  const weak      = allCheckpoints.filter(c => c.score < 60).length;
  const doughnutData = {
    labels: ['Kiváló (≥80%)', 'Jó (60–79%)', 'Fejleszthető (<60%)'],
    datasets: [{
      data: [excellent, good, weak],
      backgroundColor: ['rgba(16,185,129,0.82)', 'rgba(59,130,246,0.82)', 'rgba(245,158,11,0.82)'],
      borderColor: ['#10b981', '#3b82f6', '#f59e0b'],
      borderWidth: 2,
      hoverOffset: 10,
    }]
  };
  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} fejezet` } }
    },
    cutout: '64%'
  };
  const doughnutLegend = [
    { label: 'Kiváló (≥80%)',      color: '#10b981', count: excellent },
    { label: 'Jó (60–79%)',         color: '#3b82f6', count: good },
    { label: 'Fejleszthető (<60%)', color: '#f59e0b', count: weak },
  ];

  /* ── Line: progress trend ── */
  const sortedCps = [...allCheckpoints]
    .filter(c => c.completedAt)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const trendPoints = sortedCps.length >= 2 ? sortedCps : allCheckpoints;
  const winSize = Math.max(2, Math.floor(trendPoints.length / 3));
  const movingAvg = trendPoints.map((_, i) => {
    const slice = trendPoints.slice(Math.max(0, i - winSize + 1), i + 1);
    return Math.round(slice.reduce((s, c) => s + c.score, 0) / slice.length);
  });
  const trendLineData = {
    labels: trendPoints.map((_, i) => `${i + 1}.`),
    datasets: [
      {
        label: 'Pontszám',
        data: trendPoints.map(c => c.score),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.08)',
        tension: 0.4, pointRadius: 4, borderWidth: 2.5, fill: true,
      },
      {
        label: 'Trend',
        data: movingAvg,
        borderColor: '#f59e0b',
        borderDash: [6, 3],
        pointRadius: 0, borderWidth: 2, fill: false,
      }
    ]
  };
  const trendOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}%` } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } }
    }
  };

  /* ── Radar: aggregated diagnostic ── */
  const catMap = {};
  (diagnosticBySubject || []).forEach(dr => {
    (dr.categoryAnalysis || []).forEach(cat => {
      if (!catMap[cat.category]) catMap[cat.category] = { total: 0, n: 0 };
      catMap[cat.category].total += (cat.score || 0);
      catMap[cat.category].n++;
    });
  });
  const radarEntries = Object.entries(catMap)
    .map(([name, d]) => ({ name, avg: Math.round(d.total / d.n) }))
    .slice(0, 8);
  const radarData = {
    labels: radarEntries.map(c => c.name),
    datasets: [{
      label: 'Teljesítmény (%)',
      data: radarEntries.map(c => c.avg),
      backgroundColor: 'rgba(99,102,241,0.18)',
      borderColor: '#6366f1',
      borderWidth: 2,
      pointBackgroundColor: '#6366f1',
      pointRadius: 4,
    }]
  };
  const radarOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        beginAtZero: true, max: 100,
        ticks: { stepSize: 25, font: { size: 9 }, backdropColor: 'transparent', color: 'rgba(156,163,175,0.8)' },
        grid: { color: 'rgba(156,163,175,0.15)' },
        angleLines: { color: 'rgba(156,163,175,0.2)' },
        pointLabels: { font: { size: 11, weight: '600' } }
      }
    }
  };

  /* ── Bar: avg score by difficulty ── */
  const diffAllLabels  = ['1 – Könnyű', '2 – Alap', '3 – Közepes', '4 – Nehéz', '5 – Haladó'];
  const diffAllColors  = ['rgba(16,185,129,0.75)', 'rgba(59,130,246,0.75)', 'rgba(245,158,11,0.75)', 'rgba(239,68,68,0.75)', 'rgba(139,92,246,0.75)'];
  const diffAllBorders = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const diffMap = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  allCheckpoints.forEach(c => { const d = c.difficulty || 3; if (diffMap[d]) diffMap[d].push(c.score); });
  const activeDiffs = [1,2,3,4,5].filter(d => diffMap[d].length > 0);
  const diffBarData = {
    labels: activeDiffs.map(d => diffAllLabels[d - 1]),
    datasets: [{
      label: 'Átlag pontszám (%)',
      data: activeDiffs.map(d => Math.round(diffMap[d].reduce((s,v) => s+v,0) / diffMap[d].length)),
      backgroundColor: activeDiffs.map(d => diffAllColors[d - 1]),
      borderColor: activeDiffs.map(d => diffAllBorders[d - 1]),
      borderWidth: 2, borderRadius: 10,
    }]
  };
  const diffBarOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.raw}%` } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } }
    }
  };

  return (
    <>
      <div className="sts-cards-row">
        <div className="sts-card xp-gradient">
          <div className="sts-card-icon yellow"><FaStar /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{totalXP} <span className="sts-unit">XP</span></div>
            <div className="sts-card-label">Tapasztalati pont</div>
            <div className="sts-card-sub">Szint {xpLevel}</div>
          </div>
        </div>
        <div className={`sts-card${streak >= 3 ? ' streak-hot' : ''}`}>
          <div className={`sts-card-icon${streak >= 3 ? ' red' : ' orange'}`}><FaFire /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{streak} <span className="sts-unit">nap</span></div>
            <div className="sts-card-label">Tanulási sorozat</div>
            <div className="sts-card-sub">{streak >= 7 ? 'Tűzön van! 🔥' : streak >= 3 ? 'Kitartóan tanul!' : streak === 0 ? 'Ma még nem tanult' : 'Belelendül!'}</div>
          </div>
        </div>
        <div className="sts-card">
          <div className="sts-card-icon green"><FaCheckCircle /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{totalCheckpointsCompleted}</div>
            <div className="sts-card-label">Teljesített fejezet</div>
            <div className="sts-card-sub">Összesen, minden tantárgy</div>
          </div>
        </div>
        <div className="sts-card">
          <div className="sts-card-icon purple"><FaChartBar /></div>
          <div className="sts-card-body">
            <div className="sts-card-value">{overallAvgScore > 0 ? `${overallAvgScore}%` : '–'}</div>
            <div className="sts-card-label">Átlagos eredmény</div>
            <div className="sts-card-sub">Minden tantárgy</div>
          </div>
        </div>
      </div>

      {badges && badges.length > 0 && (
        <div className="sts-section">
          <h2 className="sts-section-title">🏆 Elért kitűzők</h2>
          <div className="sts-badges-row">
            {badges.map((b, i) => (
              <div key={i} className="sts-badge">
                <span className="sts-badge-icon">{b.icon}</span>
                <span className="sts-badge-name">{b.name}</span>
                <span className="sts-badge-desc">{b.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allCheckpoints.length > 0 ? (
        <div className="sts-section">
          <h2 className="sts-section-title">Összesített statisztikák</h2>
          <div className="sts-agg-grid">
            <div className="sts-chart-card">
              <h3 className="sts-chart-title">Teljesítmény eloszlás</h3>
              <p className="sts-chart-sub">Összes fejezet eredménye kategóriánként</p>
              <div className="sts-doughnut-wrap">
                <div className="sts-chart-wrap sts-chart-wrap--md">
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
                <div className="sts-doughnut-center">
                  <span className="sts-doughnut-total">{allCheckpoints.length}</span>
                  <span className="sts-doughnut-label">fejezet</span>
                </div>
              </div>
              <div className="sts-doughnut-legend">
                {doughnutLegend.map((l, i) => (
                  <div key={i} className="sts-doughnut-legend-item">
                    <span className="sts-doughnut-dot" style={{ background: l.color }} />
                    <span className="sts-doughnut-legend-label">{l.label}</span>
                    <span className="sts-doughnut-legend-count" style={{ color: l.color }}>{l.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sts-chart-card">
              <h3 className="sts-chart-title">Fejlődési görbe</h3>
              <p className="sts-chart-sub">Fejezetek pontszámai időrendben + trendvonal</p>
              <div className="sts-chart-wrap">
                {trendPoints.length >= 2
                  ? <Line data={trendLineData} options={trendOptions} />
                  : <div className="sts-chart-empty">Legalább 2 teljesített fejezet szükséges</div>
                }
              </div>
            </div>

            <div className="sts-chart-card">
              <h3 className="sts-chart-title">Szintfelmérő kategóriák</h3>
              <p className="sts-chart-sub">Összes szintfelmérő aggregált kategória-teljesítménye</p>
              <div className="sts-chart-wrap">
                {radarEntries.length >= 3
                  ? <Radar data={radarData} options={radarOptions} />
                  : <div className="sts-chart-empty">Nincs elég szintfelmérő adat</div>
                }
              </div>
            </div>

            <div className="sts-chart-card">
              <h3 className="sts-chart-title">Nehézségi szint szerinti eredmény</h3>
              <p className="sts-chart-sub">Átlagos pontszám fejezetenként, nehézség alapján</p>
              <div className="sts-chart-wrap">
                <Bar data={diffBarData} options={diffBarOptions} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="sts-empty">
          <div className="sts-empty-icon">🎯</div>
          <h3>Gyermekednek még nincs egyéni gyakorlás adata</h3>
          <p>Amint elkezdi az egyéni gyakorlást, itt láthatod az összesített statisztikákat.</p>
        </div>
      )}
    </>
  );
};

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
const ParentStatistics = () => {
  const [children, setChildren] = useState([]);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
  const [activeTab, setActiveTab] = useState('assignments');
  const [assignmentStats, setAssignmentStats] = useState(null);
  const [practiceStats, setPracticeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await fetch('/api/parent/children', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
        });
        const data = await res.json();
        if (data.children && data.children.length > 0) {
          setChildren(data.children);
          if (!selectedChildId || !data.children.some(c => c._id === selectedChildId)) {
            const firstId = data.children[0]._id;
            setSelectedChildId(firstId);
            localStorage.setItem('parent-selected-child', firstId);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      } finally {
        setChildrenLoaded(true);
      }
    };
    fetchChildren();
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const [aRes, pRes] = await Promise.all([
          fetch(`/api/parent/child/${selectedChildId}/statistics`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
          }),
          fetch(`/api/parent/child/${selectedChildId}/practice-statistics`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
          })
        ]);
        const [aData, pData] = await Promise.all([aRes.json(), pRes.json()]);
        if (aRes.ok) setAssignmentStats(aData);
        if (pRes.ok) setPracticeStats(pData);
        if (!aRes.ok || !pRes.ok) setError('Nem sikerült betölteni a statisztikákat.');
      } catch (err) {
        setError('Hiba a statisztikák lekérésekor.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selectedChildId]);

  const handleChildChange = (id) => {
    setSelectedChildId(id);
    localStorage.setItem('parent-selected-child', id);
  };

  if (childrenLoaded && children.length === 0) {
    return (
      <div id="content">
        <div className="sts-page">
          <div className="page-header-banner">
            <div className="phb-icon"><FaChartBar /></div>
            <div className="phb-text">
              <h1 className="phb-title">Statisztikák és Elemzések</h1>
              <p className="phb-subtitle">Kövesd nyomon gyermeked fejlődését részletes grafikonokkal és adatokkal.</p>
            </div>
          </div>
          <div className="sts-empty">
            <div className="sts-empty-icon">👨‍👩‍👧</div>
            <h3>Nincs összekapcsolt gyermek</h3>
            <p>A statisztikák megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="content">
      <div className="sts-page">
        <div className="page-header-banner">
          <div className="phb-icon"><FaChartBar /></div>
          <div className="phb-text">
            <h1 className="phb-title">Statisztikák és Elemzések</h1>
            <p className="phb-subtitle">Kövesd nyomon gyermeked fejlődését részletes grafikonokkal és adatokkal.</p>
          </div>
          {children.length > 0 && (
            <ParentChildSelector
              childrenList={children}
              selectedId={selectedChildId}
              onChange={handleChildChange}
            />
          )}
        </div>

        <div className="sts-tabs">
          <button
            className={`sts-tab${activeTab === 'assignments' ? ' active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            <FaTrophy /> Dolgozatok
          </button>
          <button
            className={`sts-tab${activeTab === 'practice' ? ' active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <FaStar /> Egyéni Gyakorlás
          </button>
        </div>

        <div className="sts-tab-content">
          {(!childrenLoaded || loading) ? (
            <div style={{ minHeight: 300 }}><LoadingSpinner /></div>
          ) : error ? (
            <div className="error-box"><FaExclamationCircle /> {error}</div>
          ) : (
            <>
              {activeTab === 'assignments' && <AssignmentTab data={assignmentStats} />}
              {activeTab === 'practice'    && <PracticeTab   data={practiceStats}   />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentStatistics;
