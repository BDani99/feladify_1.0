import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserPlus, FaTrophy, FaFire, FaChartLine, FaCheckCircle, FaHourglassHalf, FaArrowRight, FaExclamationCircle } from 'react-icons/fa';
import '../../styles/Student/StudentDashboard.css'; // Reuses existing clean styles + overrides

const ParentDashboard = () => {
    const navigate = useNavigate();
    const [children, setChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
                        localStorage.setItem('parent-selected-child', data.children[0]._id);
                    }
                } else {
                    setChildren([]);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                setError('Hiba történt a gyermekek betöltésekor.');
                setLoading(false);
            }
        };
        fetchChildren();
    }, [selectedChildId]);

    useEffect(() => {
        if (!selectedChildId) return;
        const fetchOverview = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/parent/child/${selectedChildId}/overview`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setOverview(data);
                } else {
                    setError('Nem sikerült betölteni a részleteket.');
                }
            } catch (err) {
                console.error(err);
                setError('Hiba az adatok lekérésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchOverview();
    }, [selectedChildId]);

    const handleChildChange = (e) => {
        const id = e.target.value;
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    if (children.length === 0 && !loading) {
        return (
            <div id='content' className="d-flex flex-column align-items-center justify-content-center text-center p-5" style={{ minHeight: '80vh' }}>
                <div className="glass-card p-5 text-center shadow-lg" style={{ maxWidth: '600px', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <FaUserPlus className="text-primary mb-4" style={{ fontSize: '4rem' }} />
                    <h2 className="mb-3" style={{ fontWeight: '700' }}>Nincs még összekapcsolt gyermek</h2>
                    <p className="text-muted mb-4">
                        A szülői fiók használatához először hozzá kell adnod gyermekedet a Beállítások menüpontban az e-mail címe alapján.
                    </p>
                    <button className="main-button px-4 py-2" onClick={() => navigate('/szulo-beallitasok')}>
                        Gyermek hozzáadása <FaArrowRight className="ms-2" />
                    </button>
                </div>
            </div>
        );
    }

    const currentChild = children.find(c => c._id === selectedChildId);

    return (
        <div id="content" className="container py-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-5 gap-3">
                <div>
                    <h1 className="main-title text-start mb-1">Szülői Irányítópult</h1>
                    <p className="text-muted">Kísérd figyelemmel gyermeked haladását, eredményeit és teendőit.</p>
                </div>

                <div className="d-flex align-items-center gap-2 glass-card px-3 py-2" style={{ borderRadius: '16px' }}>
                    <span className="text-muted me-2" style={{ fontSize: '0.9rem' }}>Gyermek kiválasztása:</span>
                    <select 
                        className="form-select border-0 bg-transparent text-primary" 
                        value={selectedChildId} 
                        onChange={handleChildChange}
                        style={{ fontWeight: '600', cursor: 'pointer', outline: 'none', boxShadow: 'none' }}
                    >
                        {children.map(c => (
                            <option key={c._id} value={c._id}>{c.name} ({c.className})</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Betöltés...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="alert alert-danger glass-card d-flex align-items-center gap-2" role="alert">
                    <FaExclamationCircle /> {error}
                </div>
            ) : overview && (
                <>
                    {/* Statisztikai Kártyák */}
                    <div className="row g-4 mb-5">
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="glass-card p-4 text-start d-flex justify-content-between align-items-center transition-card" style={{ height: '100%', borderRadius: '20px' }}>
                                <div>
                                    <span className="text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>Összesített Pontszám</span>
                                    <h3 className="mb-0 text-primary" style={{ fontWeight: '800' }}>{overview.stats.totalXP} XP</h3>
                                </div>
                                <div className="p-3 bg-primary bg-opacity-10 text-primary" style={{ borderRadius: '15px' }}>
                                    <FaTrophy style={{ fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="glass-card p-4 text-start d-flex justify-content-between align-items-center transition-card" style={{ height: '100%', borderRadius: '20px' }}>
                                <div>
                                    <span className="text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>Aktív Széria</span>
                                    <h3 className="mb-0 text-warning" style={{ fontWeight: '800' }}>{overview.stats.streak} Nap</h3>
                                </div>
                                <div className="p-3 bg-warning bg-opacity-10 text-warning" style={{ borderRadius: '15px' }}>
                                    <FaFire style={{ fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="glass-card p-4 text-start d-flex justify-content-between align-items-center transition-card" style={{ height: '100%', borderRadius: '20px' }}>
                                <div>
                                    <span className="text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>Érdemjegyek Átlaga</span>
                                    <h3 className="mb-0 text-success" style={{ fontWeight: '800' }}>{overview.stats.averageGrade}</h3>
                                </div>
                                <div className="p-3 bg-success bg-opacity-10 text-success" style={{ borderRadius: '15px' }}>
                                    <FaChartLine style={{ fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="glass-card p-4 text-start d-flex justify-content-between align-items-center transition-card" style={{ height: '100%', borderRadius: '20px' }}>
                                <div>
                                    <span className="text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>Megoldott Dolgozatok</span>
                                    <h3 className="mb-0 text-info" style={{ fontWeight: '800' }}>{overview.stats.completedCount} db</h3>
                                </div>
                                <div className="p-3 bg-info bg-opacity-10 text-info" style={{ borderRadius: '15px' }}>
                                    <FaCheckCircle style={{ fontSize: '1.8rem' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alertek és Sürgős Értesítések */}
                    <div className="row">
                        <div className="col-12 col-lg-8 mx-auto">
                            <div className="glass-card p-4 mb-4" style={{ borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                <h4 className="mb-4 text-start" style={{ fontWeight: '700' }}>Sürgős Értesítések</h4>
                                {overview.alerts.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <FaCheckCircle className="text-success mb-3" style={{ fontSize: '2.5rem' }} />
                                        <p className="mb-0">Nincsenek sürgős figyelmeztetések. Minden a legnagyobb rendben halad!</p>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-3">
                                        {overview.alerts.map((alert, idx) => (
                                            <div 
                                                key={idx} 
                                                className={`p-3 d-flex align-items-center justify-content-between gap-3 alert-item`}
                                                style={{ 
                                                    borderRadius: '16px', 
                                                    backgroundColor: alert.type === 'deadline' ? 'rgba(255, 193, 7, 0.08)' : 'rgba(40, 167, 69, 0.08)',
                                                    border: alert.type === 'deadline' ? '1px solid rgba(255, 193, 7, 0.2)' : '1px solid rgba(40, 167, 69, 0.2)',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="flex-shrink-0">
                                                        {alert.type === 'deadline' ? (
                                                            <FaHourglassHalf className="text-warning" style={{ fontSize: '1.5rem' }} />
                                                        ) : (
                                                            <FaCheckCircle className="text-success" style={{ fontSize: '1.5rem' }} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h6 className="mb-1" style={{ fontWeight: '700' }}>{alert.title}</h6>
                                                        <p className="mb-0 text-muted" style={{ fontSize: '0.85rem' }}>{alert.message}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    className="btn btn-sm btn-link text-primary d-flex align-items-center gap-1 flex-shrink-0"
                                                    onClick={() => alert.type === 'deadline' ? navigate('/szulo-teendok') : navigate('/szulo-eredmenyek')}
                                                    style={{ textDecoration: 'none', fontWeight: '600' }}
                                                >
                                                    Részletek <FaArrowRight />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ParentDashboard;
