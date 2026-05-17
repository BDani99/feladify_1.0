import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaSearch, FaChevronRight, FaAward, FaCalendarAlt, FaSadTear } from 'react-icons/fa';
import '../../styles/Student/StudentDashboard.css';

const ParentResults = () => {
    const navigate = useNavigate();
    const [children, setChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

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
        if (!selectedChildId) return;
        const fetchResults = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/parent/child/${selectedChildId}/results`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.results || []);
                } else {
                    setError('Nem sikerült betölteni a gyermek eredményeit.');
                }
            } catch (err) {
                console.error(err);
                setError('Hiba az eredmények lekérésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchResults();
    }, [selectedChildId]);

    const handleChildChange = (e) => {
        const id = e.target.value;
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    const filteredResults = results.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (children.length === 0 && !loading) {
        return (
            <div id='content' className="d-flex flex-column align-items-center justify-content-center text-center p-5" style={{ minHeight: '80vh' }}>
                <div className="glass-card p-5 text-center shadow-lg" style={{ maxWidth: '600px', borderRadius: '24px' }}>
                    <FaCheckCircle className="text-success mb-4" style={{ fontSize: '4rem' }} />
                    <h2 className="mb-3">Nincs még összekapcsolt gyermek</h2>
                    <p className="text-muted mb-4">Az elért osztályzatok megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
                </div>
            </div>
        );
    }

    return (
        <div id="content" className="container py-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between mb-5 gap-3">
                <div>
                    <h1 className="main-title text-start mb-1">Eredmények és Osztályzatok</h1>
                    <p className="text-muted">Tekintsd meg gyermeked javított dolgozatainak részletes értékeléseit és visszajelzéseit.</p>
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

            {/* Kereső sáv */}
            <div className="d-flex align-items-center mb-5 position-relative" style={{ maxWidth: '400px' }}>
                <FaSearch className="position-absolute text-muted ms-3" style={{ pointerEvents: 'none' }} />
                <input 
                    type="text" 
                    className="form-control rounded-pill ps-5 bg-opacity-10 bg-secondary" 
                    placeholder="Keresés dolgozat címe vagy tantárgy alapján..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: '1px solid rgba(255,255,255,0.1)', height: '45px', color: 'inherit' }}
                />
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Betöltés...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="alert alert-danger glass-card" role="alert">{error}</div>
            ) : (
                <div className="d-flex flex-column gap-3">
                    {filteredResults.length === 0 ? (
                        <div className="glass-card text-center p-5 text-muted" style={{ borderRadius: '24px' }}>
                            <FaSadTear className="mb-3" style={{ fontSize: '3rem' }} />
                            <p className="mb-0">Nincsenek megoldott dolgozatok a megadott szűrés alapján.</p>
                        </div>
                    ) : (
                        filteredResults.map(r => {
                            const percent = r.totalPoints > 0 ? Math.round((r.achievedPoints / r.totalPoints) * 100) : 0;
                            return (
                                <div 
                                    key={r.assignmentId} 
                                    className="glass-card p-4 d-flex flex-wrap justify-content-between align-items-center gap-3 transition-card"
                                    style={{ borderRadius: '20px', textAlign: 'left' }}
                                >
                                    <div className="d-flex align-items-center gap-4">
                                        <div className="p-3 bg-success bg-opacity-10 text-success d-none d-sm-block" style={{ borderRadius: '15px' }}>
                                            <FaAward style={{ fontSize: '1.5rem' }} />
                                        </div>
                                        <div>
                                            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                                <span className="badge bg-primary bg-opacity-10 text-primary px-2.5 py-1" style={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>{r.subject}</span>
                                                <span className="badge bg-success bg-opacity-10 text-success px-2.5 py-1" style={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600' }}>Érdemjegy: {r.grade || 'Javítás alatt'}</span>
                                            </div>
                                            <h5 className="mb-1" style={{ fontWeight: '700' }}>{r.title}</h5>
                                            <div className="d-flex gap-3 text-muted" style={{ fontSize: '0.85rem' }}>
                                                <span className="d-flex align-items-center gap-1"><FaCalendarAlt /> Megoldva: {r.completedAt ? new Date(r.completedAt).toLocaleDateString('hu-HU') : '—'}</span>
                                                <span className="d-flex align-items-center gap-1"><FaCheckCircle /> Pontszám: {r.achievedPoints} / {r.totalPoints} pont ({percent}%)</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        className="main-button py-2 px-4 d-flex align-items-center gap-2" 
                                        onClick={() => navigate(`/szulo-eredmenyek/${r.assignmentId}`)}
                                    >
                                        Részletes elemzés <FaChevronRight />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default ParentResults;
