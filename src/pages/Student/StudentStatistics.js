import React, { useState, useEffect } from 'react';
import { fetchStudentStatistics, fetchPracticeStatistics } from '../../api/Student/Roadmap';
import LoadingSpinner from '../../components/LoadingSpinner';
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
  FaBrain, FaBook, FaCheckCircle, FaClock, FaChevronDown, FaChevronUp
} from 'react-icons/fa';
import '../../styles/Student/StudentStatistics.css';

ChartJS.register(
  Title, Tooltip, Legend, Filler,
  PointElement, LineElement, BarElement, ArcElement,
  CategoryScale, LinearScale, RadialLinearScale
);

const SUBJECT_ICONS = { Matematika: '🔢', Magyar: '📖', Angol: '🌍', Környezetismeret: '🌱' };

/* ─── Score colour helper ─── */
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

  // A lista newest-first sorrendben van (backend rendezi), a charthoz fordítjuk hogy időrendben legyen (régebbi balra)
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
      {/* Summary row */}
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
          {/* Score timeline */}
          <div className="sts-section">
            <h2 className="sts-section-title">Pontszámok időbeli alakulása</h2>
            <div className="sts-chart-card">
              <div className="sts-chart-wrap">
                <Line data={lineData} options={lineOptions} />
              </div>
            </div>
          </div>

          {/* Assignment list */}
          <div className="sts-section">
            <h2 className="sts-section-title">Dolgozatok részletei</h2>
            <div className="sts-card-block">
              {assignmentsStatistics.map((a, i) => {
                const pct = a.totalPoints > 0 ? Math.round((a.achievedPoints / a.totalPoints) * 100) : 0;
                const gradeColors = { 5: '#10b981', 4: '#3b82f6', 3: '#f59e0b', 2: '#f97316', 1: '#ef4444' };
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

          {/* Strengths / Weaknesses */}
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
          <h3>Még nincsenek dolgozataid</h3>
          <p>Amint a tanárod kioszt egy dolgozatot, itt láthatod a statisztikáidat.</p>
        </div>
      )}
    </>
  );
};

/* ══════════════════════════════════════════════
   PRACTICE TAB
══════════════════════════════════════════════ */
const STATUS_MAP = {
  not_started:          { label: 'Nem kezdett',        color: '#6b7280' },
  requires_diagnostic:  { label: 'Felmérő szükséges',  color: '#f59e0b' },
  in_progress:          { label: 'Folyamatban',         color: '#3b82f6' },
  level_complete:       { label: 'Szint teljesítve ✓', color: '#10b981' }
};

const SubjectCard = ({ sub, diag }) => {
  const [open, setOpen] = useState(false);
  const progressPct = sub.totalCheckpoints > 0
    ? Math.round((sub.completedCheckpoints / sub.totalCheckpoints) * 100)
    : 0;
  const statusInfo = STATUS_MAP[sub.status] || STATUS_MAP.not_started;

  return (
    <div className={`sts-subject-card${open ? ' expanded' : ''}`}>
      {/* Header */}
      <button className="sts-subject-header" onClick={() => setOpen(v => !v)}>
        <div className="sts-subject-left">
          <span className="sts-subject-emoji">{SUBJECT_ICONS[sub.subject] || '📚'}</span>
          <div>
            <div className="sts-subject-name">{sub.subject}</div>
            <div className="sts-subject-status" style={{ color: statusInfo.color }}>{statusInfo.label}</div>
          </div>
        </div>
        <div className="sts-subject-right">
          <span className="sts-level-badge">Szint {sub.currentLevel}</span>
          {open ? <FaChevronUp className="sts-chevron" /> : <FaChevronDown className="sts-chevron" />}
        </div>
      </button>

      {/* Compact stats */}
      <div className="sts-subject-stats">
        <div className="sts-mini-stat">
          <span className="sts-mini-label">Fejezetek</span>
          <span className="sts-mini-value">{sub.completedCheckpoints}/{sub.totalCheckpoints}</span>
        </div>
        <div className="sts-mini-stat">
          <span className="sts-mini-label">Átlag</span>
          <span className="sts-mini-value" style={{ color: sub.avgScore > 0 ? scoreColor(sub.avgScore) : undefined }}>{sub.avgScore > 0 ? `${sub.avgScore}%` : '–'}</span>
        </div>
        <div className="sts-mini-stat">
          <span className="sts-mini-label">Legjobb</span>
          <span className="sts-mini-value" style={{ color: sub.bestScore > 0 ? scoreColor(sub.bestScore) : undefined }}>{sub.bestScore > 0 ? `${sub.bestScore}%` : '–'}</span>
        </div>
        {sub.subjectXP > 0 && (
          <div className="sts-mini-stat">
            <span className="sts-mini-label">XP</span>
            <span className="sts-mini-value sts-xp-value">⭐ {sub.subjectXP}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="sts-subject-progress">
        <div className="sts-progress-track">
          <div className="sts-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="sts-progress-label">{progressPct}%</span>
      </div>

      {/* Expandable details */}
      {open && (
        <div className="sts-subject-details">
          {sub.checkpointDetails && sub.checkpointDetails.length > 0 && (
            <div className="sts-detail-section">
              <h4>Fejezetek eredményei</h4>
              {sub.checkpointDetails.map((cp, i) => (
                <div key={i} className="sts-bar-row">
                  <span className="sts-bar-label">{cp.idx + 1}. Fejezet</span>
                  <div className="sts-bar-track">
                    <div className="sts-bar-fill" style={{ width: `${cp.score}%`, background: scoreGrad(cp.score) }} />
                  </div>
                  <span className="sts-bar-value" style={{ color: scoreColor(cp.score) }}>{cp.score}%</span>
                </div>
              ))}
            </div>
          )}

          {diag && (
            <div className="sts-detail-section">
              <h4>
                Legutóbbi szintfelmérő
                <span className="sts-diag-pct" style={{ color: scoreColor(diag.scorePercentage) }}>
                  {Math.round(diag.scorePercentage)}%
                </span>
              </h4>
              <div className="sts-diag-summary">
                <span className="sts-diag-correct"><strong>{diag.correctAnswers}</strong>/{diag.totalQuestions} helyes válasz</span>
              </div>

              {diag.categoryAnalysis && diag.categoryAnalysis.length > 0 && (
                <div className="sts-category-bars">
                  {diag.categoryAnalysis.map((cat, i) => {
                    const sc = Math.round(cat.score || 0);
                    return (
                      <div key={i} className="sts-bar-row">
                        <span className="sts-bar-label">{cat.category}</span>
                        <div className="sts-bar-track">
                          <div className="sts-bar-fill" style={{ width: `${sc}%`, background: sc >= 80 ? 'linear-gradient(90deg,#10b981,#34d399)' : sc >= 60 ? 'linear-gradient(90deg,#3b82f6,#60a5fa)' : 'linear-gradient(90deg,#ef4444,#f87171)' }} />
                        </div>
                        <span className="sts-bar-value" style={{ color: scoreColor(sc) }}>{sc}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {diag.aiAnalysis?.personalizedFeedback && (
                <div className="sts-ai-feedback">
                  <FaBrain className="sts-brain-icon" />
                  <p>{diag.aiAnalysis.personalizedFeedback}</p>
                </div>
              )}
            </div>
          )}

          {sub.checkpointDetails?.length === 0 && !diag && (
            <p className="sts-no-detail">Még nincs részletes adat. Kezdj el egy szintfelmérőt!</p>
          )}
        </div>
      )}
    </div>
  );
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

const PracticeTab = ({ data }) => {
  if (!data) return null;
  const { totalXP, streak, badges, subjectStats, diagnosticBySubject, totalCheckpointsCompleted, overallAvgScore } = data;
  const xpLevel = Math.floor(totalXP / 50) + 1;
  const hasData = subjectStats && subjectStats.some(s => s.status !== 'not_started');
  const activeSubs = (subjectStats || []).filter(s => s.completedCheckpoints > 0);

  /* ════════ AGGREGATE CHARTS ════════ */
  const allCheckpoints = activeSubs.flatMap(s => s.checkpointDetails);

  // 1. Doughnut – score distribution
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

  // 2. Line – progress trend (all checkpoints sorted by date, with moving-avg overlay)
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

  // 3. Radar – aggregated diagnostic category performance
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

  // 4. Bar – avg score by difficulty level (only levels with data)
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

  /* ── Bar chart: subject avg scores ── */
  const barData = {
    labels: activeSubs.map(s => s.subject),
    datasets: [{
      label: 'Átlagos pontszám (%)',
      data: activeSubs.map(s => s.avgScore),
      backgroundColor: activeSubs.map(s =>
        s.avgScore >= 80 ? 'rgba(16,185,129,0.25)' : s.avgScore >= 60 ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.25)'
      ),
      borderColor: activeSubs.map(s => scoreColor(s.avgScore)),
      borderWidth: 2,
      borderRadius: 10,
    }]
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.raw}%` } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } }
    }
  };

  /* ── Multi-line chart: checkpoint scores per subject ── */
  const maxLen = Math.max(...activeSubs.map(s => s.checkpointDetails.length), 0);
  const multiLineData = {
    labels: Array.from({ length: maxLen }, (_, i) => `${i + 1}. Fejezet`),
    datasets: activeSubs.map((s, i) => ({
      label: s.subject,
      data: Array.from({ length: maxLen }, (_, idx) => s.checkpointDetails[idx]?.score ?? null),
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '18',
      tension: 0.35,
      pointRadius: 5,
      pointHoverRadius: 7,
      borderWidth: 2.5,
      spanGaps: false,
    }))
  };
  const multiLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}%` } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } }
    }
  };

  return (
    <>
      {/* Summary cards */}
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
            <div className="sts-card-sub">{streak >= 7 ? 'Tűzön vagy! 🔥' : streak >= 3 ? 'Folytasd így!' : streak === 0 ? 'Ma még nem tanultál' : 'Kezded belejönni!'}</div>
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

      {/* Badges */}
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

      {/* Aggregate charts – only when there's checkpoint data */}
      {allCheckpoints.length > 0 && (
        <div className="sts-section">
          <h2 className="sts-section-title">Összesített statisztikák</h2>
          <div className="sts-agg-grid">

            {/* 1 – Doughnut: score distribution */}
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

            {/* 2 – Line: progress trend */}
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

            {/* 3 – Radar: diagnostic category performance */}
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

            {/* 4 – Bar: avg score by difficulty */}
            <div className="sts-chart-card">
              <h3 className="sts-chart-title">Nehézségi szint szerinti eredmény</h3>
              <p className="sts-chart-sub">Átlagos pontszám fejezetenként, nehézség alapján</p>
              <div className="sts-chart-wrap">
                <Bar data={diffBarData} options={diffBarOptions} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Per-subject cards */}
      {hasData ? (
        <div className="sts-section">
          <h2 className="sts-section-title">Tantárgyak részletei</h2>
          <div className="sts-subject-grid">
            {subjectStats
              .filter(s => s.status !== 'not_started')
              .map(sub => {
                const diag = diagnosticBySubject?.find(d => d.subject === sub.subject);
                return <SubjectCard key={sub.subject} sub={sub} diag={diag} />;
              })}
          </div>
        </div>
      ) : (
        <div className="sts-empty">
          <div className="sts-empty-icon">🎯</div>
          <h3>Még nincs egyéni gyakorlás adatod</h3>
          <p>Kezdj el egy szintfelmérőt az Egyéni Gyakorlás menüpontban!</p>
        </div>
      )}
    </>
  );
};

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
const StudentStatistics = () => {
  const [activeTab, setActiveTab] = useState('assignments');
  const [assignmentStats, setAssignmentStats] = useState(null);
  const [practiceStats, setPracticeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [aStats, pStats] = await Promise.all([
          fetchStudentStatistics(),
          fetchPracticeStatistics()
        ]);
        setAssignmentStats(aStats);
        setPracticeStats(pStats);
      } catch (err) {
        setError(err.message || 'Betöltési hiba');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div id="content">
        <div className="sts-page">
          <div className="page-header-banner">
            <div className="phb-icon"><FaChartBar /></div>
            <div className="phb-text">
              <h1 className="phb-title">Statisztikák és Elemzések</h1>
              <p className="phb-subtitle">Elemezd fejlődésedet és teljesítményedet részletes grafikonokkal</p>
            </div>
          </div>
          <LoadingSpinner />
        </div>
      </div>
    );
  }
  if (error) return <div id="content"><p style={{ padding: 24, color: 'var(--color-text-dim)' }}>{error}</p></div>;

  return (
    <div id="content">
      <div className="sts-page">
        <div className="page-header-banner">
          <div className="phb-icon"><FaChartBar /></div>
          <div className="phb-text">
            <h1 className="phb-title">Statisztikák és Elemzések</h1>
            <p className="phb-subtitle">Elemezd fejlődésedet és teljesítményedet részletes grafikonokkal</p>
          </div>
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
          {activeTab === 'assignments' && <AssignmentTab data={assignmentStats} />}
          {activeTab === 'practice'    && <PracticeTab   data={practiceStats}   />}
        </div>
      </div>
    </div>
  );
};

export default StudentStatistics;
