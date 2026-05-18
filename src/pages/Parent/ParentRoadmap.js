import React, { useState, useEffect } from 'react';
import {
    FaCompass, FaLock, FaLockOpen, FaCheckCircle,
    FaChartPie, FaFire, FaTrophy, FaCalendarAlt,
    FaStar, FaExclamationCircle, FaThumbsUp, FaArrowUp
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import ParentChildSelector from '../../components/ParentChildSelector';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Parent/ParentRoadmap.css';
import '../../styles/Student/RoadmapView.css';
import '../../styles/Student/StudentDashboard.css';

const XP_PER_LEVEL = 50;

const RadarChart = ({ data }) => {
    if (!data || data.length === 0) return (
        <div className="parent-radar-empty">
            <FaChartPie className="parent-radar-empty-icon" />
            <p>Nincs elég adat a diagram kirajzolásához.</p>
        </div>
    );
    const width = 300, height = 300, cx = 150, cy = 150, r = 100;
    const axes = data.map((d, i) => {
        const angle = (Math.PI * 2 / data.length) * i - Math.PI / 2;
        const sr = r * (d.score / 100);
        return {
            label: d.category, angle,
            xMax: cx + r * Math.cos(angle), yMax: cy + r * Math.sin(angle),
            xVal: cx + sr * Math.cos(angle), yVal: cy + sr * Math.sin(angle)
        };
    });
    const gridPolygons = [0.2, 0.4, 0.6, 0.8, 1].map(level =>
        axes.map(a => `${cx + r * level * Math.cos(a.angle)},${cy + r * level * Math.sin(a.angle)}`).join(' ')
    );
    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {gridPolygons.map((pts, i) => (
                <polygon key={i} points={pts} fill="none" stroke="var(--border-color)" strokeWidth="1" />
            ))}
            {axes.map((a, i) => (
                <line key={i} x1={cx} y1={cy} x2={a.xMax} y2={a.yMax} stroke="var(--border-color)" strokeWidth="1" />
            ))}
            <polygon points={axes.map(a => `${a.xVal},${a.yVal}`).join(' ')} fill="var(--accent-glow)" stroke="var(--accent)" strokeWidth="2.5" />
            {axes.map((a, i) => (
                <circle key={i} cx={a.xVal} cy={a.yVal} r="4.5" fill="var(--accent)" stroke="white" strokeWidth="1.5" />
            ))}
            {axes.map((a, i) => {
                const xl = cx + r * 1.26 * Math.cos(a.angle);
                const yl = cy + r * 1.26 * Math.sin(a.angle) + 4;
                const anchor = Math.cos(a.angle) > 0.1 ? 'start' : Math.cos(a.angle) < -0.1 ? 'end' : 'middle';
                return (
                    <text key={i} x={xl} y={yl} fontSize="9" fontWeight="600" fill="currentColor" textAnchor={anchor} style={{ opacity: 0.9 }}>
                        {a.label.length > 15 ? `${a.label.substring(0, 13)}...` : a.label}
                    </text>
                );
            })}
        </svg>
    );
};

const ParentRoadmap = () => {
    const [children, setChildren] = useState([]);
    const [childrenLoaded, setChildrenLoaded] = useState(false);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [subject, setSubject] = useState('Matematika');
    const [roadmap, setRoadmap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const subjectsList = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];

    useEffect(() => {
        const fetchChildren = async () => {
            try {
                const res = await fetch('/api/parent/children', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                const data = await res.json();
                if (data.children && data.children.length > 0) {
                    setChildren(data.children);
                    const stored = localStorage.getItem('parent-selected-child');
                    if (!stored || !data.children.some(c => c._id === stored)) {
                        setSelectedChildId(data.children[0]._id);
                        localStorage.setItem('parent-selected-child', data.children[0]._id);
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
        if (!selectedChildId || !subject) return;
        const fetchRoadmap = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/api/parent/child/${selectedChildId}/roadmap/${subject}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    setRoadmap(await res.json());
                } else {
                    setError('Nem sikerült betölteni a fejlődési térképet.');
                }
            } catch (err) {
                setError('Hiba a fejlődési térkép lekérésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchRoadmap();
    }, [selectedChildId, subject]);

    const handleChildChange = (id) => {
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    const checkpoints = roadmap?.checkpoints || [];
    const completedCps = checkpoints.filter(cp => cp.status === 'completed');
    const unlockedCps = checkpoints.filter(cp => cp.status === 'unlocked');
    const totalCount = checkpoints.length;
    const completedCount = completedCps.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const avgScore = completedCps.length > 0
        ? Math.round(completedCps.reduce((s, cp) => s + (cp.score || 0), 0) / completedCps.length)
        : null;
    const subjectXP = roadmap?.subjectXP || 0;
    const xpLevel = Math.floor(subjectXP / XP_PER_LEVEL) + 1;
    const xpInLevel = subjectXP % XP_PER_LEVEL;
    const levelProgress = (xpInLevel / XP_PER_LEVEL) * 100;
    const xpToNext = XP_PER_LEVEL - xpInLevel;
    const strengths = roadmap?.aiAnalysis?.strengths || [];
    const weaknesses = roadmap?.aiAnalysis?.weaknesses || [];
    const notStarted = totalCount === 0 && !(roadmap?.radarData?.length > 0);

    if (childrenLoaded && children.length === 0) {
        return (
            <div id="content">
                <div className="dashboard-container">
                    <div className="dash-section-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                        <FaCompass style={{ fontSize: '3.5rem', color: 'var(--accent)', marginBottom: 24 }} />
                        <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Nincs még összekapcsolt gyermek</h2>
                        <p style={{ color: 'var(--color-text-dim)' }}>A fejlődési térképek megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="content">
            <div className="dashboard-container">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaCompass /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Fejlődési Térkép</h1>
                        <p className="phb-subtitle">Kövesd nyomon gyermeked egyéni gyakorlásának haladását és eredményeit.</p>
                    </div>
                    {children.length > 0 && (
                        <ParentChildSelector
                            childrenList={children}
                            selectedId={selectedChildId}
                            onChange={handleChildChange}
                        />
                    )}
                </div>

                <div className="parent-subject-tabs">
                    {subjectsList.map(sub => (
                        <button
                            key={sub}
                            className={`parent-filter-btn${subject === sub ? ' active' : ''}`}
                            onClick={() => setSubject(sub)}
                        >
                            {sub}
                        </button>
                    ))}
                </div>

                {(!childrenLoaded || loading) ? (
                    <div style={{ minHeight: 300 }}><LoadingSpinner /></div>
                ) : error ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', padding: '16px 0' }}>
                        <FaExclamationCircle /> {error}
                    </div>
                ) : notStarted ? (
                    <div className="glass-card" style={{ textAlign: 'center', padding: '56px 40px' }}>
                        <FaCompass style={{ fontSize: '3rem', color: 'var(--color-text-dim)', opacity: 0.25, marginBottom: 16 }} />
                        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Még nem kezdte el ezt a tantárgyat</h3>
                        <p style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto' }}>
                            Gyermeked még nem töltötte ki a <strong>{subject}</strong> szintfelmérőt.
                            Az egyéni gyakorlás megkezdése után itt jelenik meg a teljes haladása.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ── Stats sor ── */}
                        <div className="roadmap-stats" style={{ marginBottom: 28 }}>
                            <div className="stat-card xp-card">
                                <div className="stat-card-icon">⭐</div>
                                <div className="stat-card-body">
                                    <div className="stat-card-value xp-value">{subjectXP} XP</div>
                                    <div className="stat-card-label">{subject} – tapasztalati pont</div>
                                    <div className="level-bar-wrap">
                                        <div className="level-bar-fill" style={{ width: `${levelProgress}%` }} />
                                    </div>
                                    <div className="level-bar-info">
                                        <span className="level-badge"><FaFire /> {xpLevel}. szint</span>
                                        <span className="level-next">{xpToNext} XP következőhöz</span>
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card chapters-card">
                                <div className="stat-card-icon">🎯</div>
                                <div className="stat-card-body">
                                    <div className="stat-card-value">
                                        {completedCount}<span className="stat-total">/{totalCount}</span>
                                    </div>
                                    <div className="stat-card-label">Fejezet teljesítve</div>
                                    <div className="level-bar-wrap">
                                        <div className="level-bar-fill chapters" style={{ width: `${progress}%` }} />
                                    </div>
                                    <div className="level-bar-info">
                                        <span className="progress-pct">{progress}% kész</span>
                                        {unlockedCps.length > 0 && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700 }}>
                                                {unlockedCps.length} aktív
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {avgScore !== null ? (
                                <div className="stat-card score-card">
                                    <div className="stat-card-icon"><FaTrophy /></div>
                                    <div className="stat-card-body">
                                        <div className={`stat-card-value score-value ${avgScore >= 80 ? 'good' : 'low'}`}>{avgScore}%</div>
                                        <div className="stat-card-label">Átlag pontszám</div>
                                        <div className="score-bar-wrap">
                                            <div className="score-bar-fill" style={{
                                                width: `${avgScore}%`,
                                                background: avgScore >= 80
                                                    ? 'linear-gradient(90deg,#10b981,#059669)'
                                                    : 'linear-gradient(90deg,#f59e0b,#d97706)'
                                            }} />
                                        </div>
                                        <div className="level-bar-info">
                                            <span className={`score-badge ${avgScore >= 80 ? 'good' : 'low'}`}>
                                                {avgScore >= 80 ? '✓ Jó teljesítmény' : '↑ Van hova fejlődni'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="stat-card score-card empty">
                                    <div className="stat-card-icon"><FaTrophy /></div>
                                    <div className="stat-card-body">
                                        <div className="stat-card-value empty-value">—</div>
                                        <div className="stat-card-label">Átlag pontszám</div>
                                        <div className="empty-hint">Teljesített fejezet után jelenik meg</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Radar + AI elemzés ── */}
                        <div className="parent-roadmap-grid" style={{ marginBottom: 28 }}>
                            <div className="glass-card parent-radar-card">
                                <h4 className="parent-radar-title">Diagnosztikai Térkép</h4>
                                <div className="parent-radar-svg-wrapper">
                                    <RadarChart data={roadmap?.radarData} />
                                </div>
                                {roadmap?.aiAnalysis?.feedback && (
                                    <div className="parent-radar-feedback">
                                        {roadmap.aiAnalysis.feedback}
                                    </div>
                                )}
                            </div>

                            <div className="glass-card parent-checkpoints-card">
                                <div className="parent-checkpoints-header">
                                    <h4 className="parent-checkpoints-title">AI Elemzés</h4>
                                    <span className="parent-level-badge">{roadmap?.currentLevel || 1}. szint</span>
                                </div>

                                {strengths.length === 0 && weaknesses.length === 0 ? (
                                    <div className="parent-checkpoints-empty">
                                        <FaChartPie className="parent-checkpoints-empty-icon" />
                                        <p>Az AI elemzés a szintfelmérő kitöltése után jelenik meg.</p>
                                    </div>
                                ) : (
                                    <>
                                        {strengths.length > 0 && (
                                            <div className="pr-analysis-section">
                                                <div className="pr-analysis-label pr-strength-label">
                                                    <FaThumbsUp /> Erősségek
                                                </div>
                                                {strengths.map((s, i) => (
                                                    <div key={i} className="pr-analysis-item pr-strength-item">
                                                        <div className="pr-analysis-category">{s.category}</div>
                                                        <div className="pr-analysis-desc">{s.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {weaknesses.length > 0 && (
                                            <div className="pr-analysis-section">
                                                <div className="pr-analysis-label pr-weakness-label">
                                                    <FaArrowUp /> Fejlesztendő területek
                                                </div>
                                                {weaknesses.map((w, i) => (
                                                    <div key={i} className="pr-analysis-item pr-weakness-item">
                                                        <div className="pr-analysis-category">{w.category}</div>
                                                        <div className="pr-analysis-desc">{w.description}</div>
                                                        {w.recommendedPractice > 0 && (
                                                            <div className="pr-practice-hint">
                                                                Javasolt: {w.recommendedPractice} óra gyakorlás
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ── Fejezetek timeline ── */}
                        <div className="glass-card" style={{ padding: 28 }}>
                            <div className="parent-checkpoints-header" style={{ marginBottom: 24 }}>
                                <h4 className="parent-checkpoints-title">Fejezetek és Haladás</h4>
                                <span className="parent-level-badge">{completedCount}/{totalCount} teljesítve</span>
                            </div>

                            {checkpoints.length === 0 ? (
                                <div className="parent-checkpoints-empty">
                                    <FaExclamationCircle className="parent-checkpoints-empty-icon" />
                                    <p>Ebben a tantárgyban még nem indult el a tanulási útvonal.</p>
                                </div>
                            ) : (
                                <div className="pr-checkpoints-timeline">
                                    {checkpoints.map((cp, i) => (
                                        <div key={cp.checkpointId} className={`pr-timeline-item ${cp.status}`}>
                                            <div className="pr-timeline-icon-col">
                                                <div className={`pr-timeline-dot ${cp.status}`}>
                                                    {cp.status === 'completed'
                                                        ? <FaCheckCircle />
                                                        : cp.status === 'unlocked'
                                                            ? <FaLockOpen />
                                                            : <FaLock />}
                                                </div>
                                                {i < checkpoints.length - 1 && <div className="pr-timeline-line" />}
                                            </div>

                                            <div className="pr-timeline-content">
                                                <div className="pr-timeline-header">
                                                    <span className="pr-cp-index">{i + 1}.</span>
                                                    <span className="pr-cp-topic">{cp.topic || 'Gyakorlás'}</span>
                                                    <div className="pr-cp-difficulty">
                                                        {Array.from({ length: 5 }, (_, k) => (
                                                            <FaStar key={k} style={{
                                                                color: k < (cp.difficulty || 3) ? '#f59e0b' : 'var(--border-color-2)',
                                                                fontSize: '0.65rem'
                                                            }} />
                                                        ))}
                                                    </div>
                                                </div>

                                                {cp.status === 'completed' && (
                                                    <div className="pr-cp-completed-info">
                                                        <div className="pr-cp-score-row">
                                                            <div className="pr-score-bar-wrap">
                                                                <div
                                                                    className="pr-score-bar-fill"
                                                                    style={{
                                                                        width: `${cp.score}%`,
                                                                        background: cp.score >= 80
                                                                            ? 'linear-gradient(90deg,#10b981,#059669)'
                                                                            : cp.score >= 60
                                                                                ? 'linear-gradient(90deg,#3b82f6,#2563eb)'
                                                                                : 'linear-gradient(90deg,#f59e0b,#d97706)'
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className={`pr-score-pct ${cp.score >= 80 ? 'good' : cp.score >= 60 ? 'ok' : 'low'}`}>
                                                                {cp.score}%
                                                            </span>
                                                        </div>
                                                        <div className="pr-cp-meta">
                                                            {cp.attempts > 0 && <span>{cp.attempts} kísérlet</span>}
                                                            {cp.completedAt && (
                                                                <span>
                                                                    <FaCalendarAlt style={{ fontSize: '0.65rem', opacity: 0.7 }} />{' '}
                                                                    {new Date(cp.completedAt).toLocaleDateString('hu-HU')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {cp.status === 'unlocked' && (
                                                    <span className="pr-cp-status-badge unlocked">Megnyitva – folyamatban</span>
                                                )}
                                                {cp.status === 'locked' && (
                                                    <span className="pr-cp-status-badge locked">Zárolva – előző fejezet szükséges</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ParentRoadmap;
