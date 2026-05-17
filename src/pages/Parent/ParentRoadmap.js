import React, { useState, useEffect } from 'react';
import { FaCompass, FaLock, FaLockOpen, FaCheckCircle, FaStar, FaChartPie, FaExclamationCircle } from 'react-icons/fa';
import '../../styles/Student/StudentDashboard.css';

const ParentRoadmap = () => {
    const [children, setChildren] = useState([]);
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
                    if (!selectedChildId || !data.children.some(c => c._id === selectedChildId)) {
                        setSelectedChildId(data.children[0]._id);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('Hiba történt a gyermekek betöltésekor.');
            }
        };
        fetchChildren();
    }, [selectedChildId]);

    useEffect(() => {
        if (!selectedChildId || !subject) return;
        const fetchRoadmap = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/parent/child/${selectedChildId}/roadmap/${subject}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setRoadmap(data);
                } else {
                    setError('Nem sikerült betölteni az útvonalat.');
                }
            } catch (err) {
                console.error(err);
                setError('Hiba a fejlődési térkép lekérésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchRoadmap();
    }, [selectedChildId, subject]);

    const handleChildChange = (e) => {
        const id = e.target.value;
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    // PURE REACT SVG RADAR CHART COMPONENT
    const RenderRadarChart = ({ data }) => {
        if (!data || data.length === 0) {
            return (
                <div className="text-center py-4 text-muted">
                    <FaChartPie className="mb-2" style={{ fontSize: '2.5rem' }} />
                    <p className="mb-0 small">Nincs elég adat a radar-diagram kirajzolásához.</p>
                </div>
            );
        }

        const width = 300;
        const height = 300;
        const cx = width / 2;
        const cy = height / 2;
        const r = 100;
        const numAxes = data.length;

        // Számoljuk ki az egyes kategóriák szögét és pontjait
        const axes = data.map((d, i) => {
            const angle = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
            const xMax = cx + r * Math.cos(angle);
            const yMax = cy + r * Math.sin(angle);
            const scoreRadius = r * (d.score / 100);
            const xVal = cx + scoreRadius * Math.cos(angle);
            const yVal = cy + scoreRadius * Math.sin(angle);
            return { label: d.category, xMax, yMax, xVal, yVal, angle };
        });

        // Hálózat (concentric circles)
        const levels = [0.2, 0.4, 0.6, 0.8, 1];
        const gridPolygons = levels.map(level => {
            return axes.map(axis => {
                const levelRadius = r * level;
                const x = cx + levelRadius * Math.cos(axis.angle);
                const y = cy + levelRadius * Math.sin(axis.angle);
                return `${x},${y}`;
            }).join(' ');
        });

        // Érték pontok összekötve (polygon)
        const valuePointsString = axes.map(axis => `${axis.xVal},${axis.yVal}`).join(' ');

        return (
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                {/* Hálós gyűrűk */}
                {gridPolygons.map((points, idx) => (
                    <polygon 
                        key={idx} 
                        points={points} 
                        fill="none" 
                        stroke="var(--card-border, rgba(255,255,255,0.08))" 
                        strokeWidth="1" 
                    />
                ))}

                {/* Szint körök háttér szövegek */}
                {levels.map((level, idx) => (
                    <text 
                        key={idx}
                        x={cx}
                        y={cy - r * level + 10}
                        fontSize="8"
                        fill="rgba(255,255,255,0.25)"
                        textAnchor="middle"
                    >
                        {level * 100}%
                    </text>
                ))}

                {/* Tengely vonalak */}
                {axes.map((axis, idx) => (
                    <line 
                        key={idx}
                        x1={cx}
                        y1={cy}
                        x2={axis.xMax}
                        y2={axis.yMax}
                        stroke="var(--card-border, rgba(255,255,255,0.1))"
                        strokeWidth="1"
                    />
                ))}

                {/* Kitöltött érték-poligon */}
                <polygon 
                    points={valuePointsString}
                    fill="rgba(59, 130, 246, 0.25)"
                    stroke="rgba(59, 130, 246, 1)"
                    strokeWidth="2.5"
                />

                {/* Érték pontok a csúcsokon */}
                {axes.map((axis, idx) => (
                    <circle 
                        key={idx}
                        cx={axis.xVal}
                        cy={axis.yVal}
                        r="4.5"
                        fill="var(--primary-color, #3b82f6)"
                        stroke="#fff"
                        strokeWidth="1.5"
                    />
                ))}

                {/* Tengely feliratok */}
                {axes.map((axis, idx) => {
                    const offsetMultiplier = 1.25;
                    const xLabel = cx + (r * offsetMultiplier) * Math.cos(axis.angle);
                    const yLabel = cy + (r * offsetMultiplier) * Math.sin(axis.angle) + 4;
                    const anchor = Math.cos(axis.angle) > 0.1 ? 'start' : Math.cos(axis.angle) < -0.1 ? 'end' : 'middle';
                    return (
                        <text 
                            key={idx}
                            x={xLabel}
                            y={yLabel}
                            fontSize="9"
                            fontWeight="600"
                            fill="currentColor"
                            textAnchor={anchor}
                            style={{ opacity: 0.9 }}
                        >
                            {axis.label.length > 15 ? `${axis.label.substring(0, 13)}...` : axis.label}
                        </text>
                    );
                })}
            </svg>
        );
    };

    if (children.length === 0 && !loading) {
        return (
            <div id='content' className="d-flex flex-column align-items-center justify-content-center text-center p-5" style={{ minHeight: '80vh' }}>
                <div className="glass-card p-5 text-center shadow-lg" style={{ maxWidth: '600px', borderRadius: '24px' }}>
                    <FaCompass className="text-primary mb-4" style={{ fontSize: '4rem' }} />
                    <h2 className="mb-3">Nincs még összekapcsolt gyermek</h2>
                    <p className="text-muted mb-4">A fejlődési térképek megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
                </div>
            </div>
        );
    }

    return (
        <div id="content" className="container py-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-5 gap-3">
                <div>
                    <h1 className="main-title text-start mb-1">Fejlődési Térkép</h1>
                    <p className="text-muted">Kövesd nyomon gyermeked tantárgy-specifikus haladását és erősségeit.</p>
                </div>

                <div className="d-flex align-items-center gap-2 glass-card px-3 py-2" style={{ borderRadius: '16px' }}>
                    <span className="text-muted me-2" style={{ fontSize: '0.9rem' }}>Gyermek:</span>
                    <select className="form-select border-0 bg-transparent text-primary" value={selectedChildId} onChange={handleChildChange} style={{ fontWeight: '600', cursor: 'pointer', outline: 'none' }}>
                        {children.map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tantárgy Választó */}
            <div className="d-flex flex-wrap gap-2 mb-5 justify-content-start">
                {subjectsList.map(sub => (
                    <button 
                        key={sub} 
                        className={`btn rounded-pill px-4 ${subject === sub ? 'btn-primary' : 'btn-outline-secondary bg-transparent'}`} 
                        onClick={() => setSubject(sub)}
                    >
                        {sub}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Betöltés...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="alert alert-danger glass-card" role="alert">{error}</div>
            ) : roadmap && (
                <div className="row g-4 text-start">
                    {/* Radar diagram és AI Elemzés */}
                    <div className="col-12 col-lg-5">
                        <div className="glass-card p-4 mb-4" style={{ borderRadius: '24px', height: '100%' }}>
                            <h4 className="mb-4" style={{ fontWeight: '700' }}>Erősségek és Kategóriák</h4>
                            <div className="d-flex align-items-center justify-content-center mb-4" style={{ height: '260px' }}>
                                {roadmap.radarData && roadmap.radarData.length > 0 ? (
                                    <RenderRadarChart data={roadmap.radarData} />
                                ) : (
                                    <div className="text-center text-muted">
                                        <FaCompass style={{ fontSize: '3rem' }} className="mb-3" />
                                        <p className="mb-0">Még nem áll rendelkezésre kitöltött diagnosztikai felmérő.</p>
                                    </div>
                                )}
                            </div>

                            {/* Visszajelzés */}
                            <div className="p-3 bg-secondary bg-opacity-10 text-muted rounded-4 mb-3" style={{ fontSize: '0.88rem' }}>
                                <p className="mb-0">{roadmap.aiAnalysis.feedback}</p>
                            </div>
                        </div>
                    </div>

                    {/* Checkpoint Roadmap lista */}
                    <div className="col-12 col-lg-7">
                        <div className="glass-card p-4" style={{ borderRadius: '24px', height: '100%' }}>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h4 className="mb-0" style={{ fontWeight: '700' }}>Fejezetek és Mérföldkövek</h4>
                                <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2" style={{ borderRadius: '12px', fontWeight: '700' }}>
                                    Szint: {roadmap.currentLevel}
                                </span>
                            </div>

                            {roadmap.checkpoints.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <FaExclamationCircle className="mb-3" style={{ fontSize: '2.5rem' }} />
                                    <p>Ebben a tantárgyban még nem indult el a tanulási útvonal.</p>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-3">
                                    {roadmap.checkpoints.map((cp, idx) => (
                                        <div 
                                            key={cp.checkpointId} 
                                            className="p-3 d-flex align-items-center justify-content-between rounded-4 transition-card"
                                            style={{ 
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                backgroundColor: cp.status === 'locked' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)'
                                            }}
                                        >
                                            <div className="d-flex align-items-center gap-3">
                                                <div 
                                                    className="p-2.5 rounded-3 d-flex align-items-center justify-content-center"
                                                    style={{ 
                                                        backgroundColor: cp.status === 'completed' ? 'rgba(40, 167, 69, 0.1)' : cp.status === 'unlocked' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                                        color: cp.status === 'completed' ? '#28a745' : cp.status === 'unlocked' ? '#3b82f6' : '#6c757d'
                                                    }}
                                                >
                                                    {cp.status === 'completed' ? <FaCheckCircle /> : cp.status === 'unlocked' ? <FaLockOpen /> : <FaLock />}
                                                </div>
                                                <div>
                                                    <h6 className="mb-0" style={{ fontWeight: '700', color: cp.status === 'locked' ? 'var(--text-muted, #6c757d)' : 'inherit' }}>{cp.topic}</h6>
                                                    <div className="d-flex gap-2 text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                                                        <span className="d-flex align-items-center gap-0.5"><FaStar className="text-warning" /> Nehézség: {cp.difficulty}/5</span>
                                                        {cp.attempts > 0 && <span>• Kísérletek: {cp.attempts} db</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {cp.status === 'completed' && (
                                                <span className="badge bg-success bg-opacity-10 text-success px-2.5 py-1.5" style={{ borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700' }}>
                                                    Sikeres: {cp.score}%
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParentRoadmap;
