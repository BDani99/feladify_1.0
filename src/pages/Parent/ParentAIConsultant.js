import React, { useState, useEffect, useRef } from 'react';
import { FaGraduationCap, FaPlus, FaTrash, FaPen, FaPaperPlane, FaRobot, FaUser, FaComments, FaHistory, FaCheck, FaExclamationCircle } from 'react-icons/fa';
import '../../styles/Welcome.css'; // Reuses AI Chat layout

const ParentAIConsultant = () => {
    const [children, setChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState(null);
    const [editTitleInput, setEditTitleInput] = useState('');
    const [error, setError] = useState('');

    const messagesEndRef = useRef(null);

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

    const loadChatHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/parent/chat/history', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setSessions(data.sessions || []);
                setCurrentSessionId(data.currentSessionId);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadChatHistory();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleChildChange = (e) => {
        const id = e.target.value;
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    const handleNewSession = async () => {
        try {
            const res = await fetch('/api/parent/chat/new-session', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
            });
            if (res.ok) {
                await loadChatHistory();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleLoadSession = async (sessionId) => {
        try {
            const res = await fetch('/api/parent/chat/load-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({ sessionId })
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setSessions(data.sessions || []);
                setCurrentSessionId(sessionId);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteSession = async (e, sessionId) => {
        e.stopPropagation();
        if (!window.confirm('Biztosan törölni szeretnéd ezt a konzultációs előzményt?')) return;
        try {
            const res = await fetch(`/api/parent/chat/session/${sessionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions || []);
                if (currentSessionId === sessionId) {
                    setMessages([]);
                    setCurrentSessionId(null);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleStartRename = (e, s) => {
        e.stopPropagation();
        setEditingSessionId(s.sessionId);
        setEditTitleInput(s.title);
    };

    const handleSaveRename = async (e, sessionId) => {
        e.stopPropagation();
        if (!editTitleInput.trim()) return;
        try {
            const res = await fetch(`/api/parent/chat/session/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({ title: editTitleInput.trim() })
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions || []);
                setEditingSessionId(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || sending || !selectedChildId) return;

        const userMsg = input.trim();
        setInput('');
        setSending(true);

        // Add local user message instantly
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

        try {
            const res = await fetch('/api/parent/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({
                    message: userMsg,
                    childId: selectedChildId,
                    stream: true
                })
            });

            if (!res.ok) {
                throw new Error('Hiba történt a válasz fogadásakor.');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = '';

            // Add placeholder assistant message
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.chunk) {
                                aiResponse += data.chunk;
                                setMessages(prev => {
                                    const copy = [...prev];
                                    copy[copy.length - 1].content = aiResponse;
                                    return copy;
                                });
                            }
                            if (data.done) {
                                setCurrentSessionId(data.sessionId);
                            }
                        } catch (parseErr) {
                            // Ignore line parses
                        }
                    }
                }
            }
            await loadChatHistory();
        } catch (err) {
            console.error(err);
            setError(err.message || 'Valami nem sikerült. Próbáld újra.');
        } finally {
            setSending(false);
        }
    };

    if (children.length === 0 && !loading) {
        return (
            <div id='content' className="d-flex flex-column align-items-center justify-content-center text-center p-5" style={{ minHeight: '80vh' }}>
                <div className="glass-card p-5 text-center shadow-lg" style={{ maxWidth: '600px', borderRadius: '24px' }}>
                    <FaGraduationCap className="text-primary mb-4" style={{ fontSize: '4rem' }} />
                    <h2 className="mb-3">Nincs még összekapcsolt gyermek</h2>
                    <p className="text-muted mb-4">Az AI tanácsadó használatához adj hozzá egy gyermeket a Beállítások menüben.</p>
                </div>
            </div>
        );
    }

    return (
        <div id="content" className="container py-4">
            <div className="row g-4 text-start" style={{ minHeight: '82vh' }}>
                {/* Chat előzmények sáv */}
                <div className="col-12 col-md-4 col-lg-3">
                    <div className="glass-card p-3 d-flex flex-column" style={{ borderRadius: '24px', height: '100%', minHeight: '400px' }}>
                        <button className="main-button w-100 py-2.5 px-3 mb-4 d-flex align-items-center justify-content-center gap-2" onClick={handleNewSession}>
                            <FaPlus /> Új konzultáció
                        </button>
                        
                        <h6 className="text-muted mb-3 d-flex align-items-center gap-2 px-2" style={{ fontWeight: '700', fontSize: '0.82rem' }}>
                            <FaHistory /> Konzulációs előzmények
                        </h6>

                        <div className="d-flex flex-column gap-2 overflow-y-auto flex-grow-1 pe-1" style={{ maxHeight: '420px' }}>
                            {sessions.length === 0 ? (
                                <div className="text-center py-4 text-muted small">Nincsenek korábbi beszélgetések.</div>
                            ) : (
                                sessions.map(s => (
                                    <div 
                                        key={s.sessionId} 
                                        className={`p-2.5 rounded-3 d-flex align-items-center justify-content-between gap-2 interactive ${currentSessionId === s.sessionId ? 'bg-primary bg-opacity-10 border border-primary text-primary' : 'bg-secondary bg-opacity-5'}`}
                                        onClick={() => handleLoadSession(s.sessionId)}
                                        style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
                                    >
                                        <div className="d-flex align-items-center gap-2 overflow-hidden flex-grow-1">
                                            <FaComments className="flex-shrink-0 text-muted" />
                                            {editingSessionId === s.sessionId ? (
                                                <input 
                                                    type="text" 
                                                    className="form-control form-control-sm border-primary text-white bg-transparent py-0 px-1" 
                                                    value={editTitleInput} 
                                                    onChange={(e) => setEditTitleInput(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    maxLength="100"
                                                    style={{ fontSize: '0.8rem' }}
                                                />
                                            ) : (
                                                <span className="text-truncate" style={{ fontSize: '0.82rem', fontWeight: '600' }}>{s.title}</span>
                                            )}
                                        </div>
                                        <div className="d-flex align-items-center gap-1">
                                            {editingSessionId === s.sessionId ? (
                                                <button className="btn btn-sm p-1 text-success border-0 bg-transparent" onClick={(e) => handleSaveRename(e, s.sessionId)}><FaCheck style={{ fontSize: '0.75rem' }} /></button>
                                            ) : (
                                                <button className="btn btn-sm p-1 text-muted border-0 bg-transparent" onClick={(e) => handleStartRename(e, s)}><FaPen style={{ fontSize: '0.72rem' }} /></button>
                                            )}
                                            <button className="btn btn-sm p-1 text-muted hover-danger border-0 bg-transparent" onClick={(e) => handleDeleteSession(e, s.sessionId)}><FaTrash style={{ fontSize: '0.72rem' }} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Fő csevegő felület */}
                <div className="col-12 col-md-8 col-lg-9 d-flex flex-column">
                    <div className="glass-card p-4 d-flex flex-column flex-grow-1" style={{ borderRadius: '24px', height: '100%', minHeight: '520px' }}>
                        {/* Felül: Választott gyermek és AI bemutatkozás */}
                        <div className="d-flex flex-wrap align-items-center justify-content-between border-bottom border-white border-opacity-10 pb-3 mb-4 gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-2.5 bg-primary bg-opacity-10 text-primary rounded-3">
                                    <FaRobot style={{ fontSize: '1.6rem' }} />
                                </div>
                                <div>
                                    <h5 className="mb-0" style={{ fontWeight: '800' }}>AI Pedagógiai Tanácsadó</h5>
                                    <span className="badge bg-success bg-opacity-10 text-success px-2 py-0.5 mt-1" style={{ fontSize: '0.7rem' }}>Aktív Konzulens</span>
                                </div>
                            </div>

                            <div className="d-flex align-items-center gap-2 glass-card px-2.5 py-1.5" style={{ borderRadius: '12px', fontSize: '0.85rem' }}>
                                <span className="text-muted">Aktuális gyermek kontextus:</span>
                                <select className="form-select border-0 bg-transparent text-primary py-0" value={selectedChildId} onChange={handleChildChange} style={{ fontWeight: '600', width: 'auto', boxShadow: 'none' }}>
                                    {children.map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {error && (
                            <div className="alert alert-danger d-flex align-items-center gap-2 mb-3 py-2" role="alert">
                                <FaExclamationCircle /> {error}
                            </div>
                        )}

                        {/* Üzenetek zónája */}
                        <div className="flex-grow-1 overflow-y-auto px-1 mb-4 d-flex flex-column gap-3" style={{ maxHeight: '440px', minHeight: '300px' }}>
                            {messages.length === 0 ? (
                                <div className="d-flex flex-column align-items-center justify-content-center text-center m-auto text-muted p-4" style={{ maxWidth: '480px' }}>
                                    <FaRobot className="mb-3 text-primary bg-primary bg-opacity-5 p-3 rounded-circle" style={{ fontSize: '4.5rem' }} />
                                    <h5 style={{ fontWeight: '700' }}>Pedagógiai AI Tanácsadó</h5>
                                    <p className="small">
                                        Kérdezz bátran gyermeked fejlődéséről, kérj ötleteket játékos konyhai matek feladatokhoz, közös angol tanuláshoz, vagy hogyan motiválhatnád a házi feladatok megoldására!
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={`d-flex gap-3 text-start ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                                        {msg.role !== 'user' && (
                                            <div className="p-2 bg-primary bg-opacity-10 text-primary rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                                                <FaRobot />
                                            </div>
                                        )}
                                        <div 
                                            className={`p-3 rounded-4 message-bubble ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-secondary bg-opacity-5'}`}
                                            style={{ 
                                                maxWidth: '75%', 
                                                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                                fontSize: '0.92rem',
                                                lineHeight: '1.5',
                                                whiteSpace: 'pre-wrap'
                                            }}
                                        >
                                            {msg.content}
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="p-2 bg-secondary bg-opacity-15 text-muted rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                                                <FaUser />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Beviteli mező */}
                        <form className="d-flex align-items-center position-relative" onSubmit={handleSend}>
                            <input 
                                type="text"
                                className="form-control rounded-pill ps-4 pe-5 bg-opacity-10 bg-secondary"
                                placeholder="Írd le a kérdésed a gyermeked tanulásával kapcsolatban..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={sending}
                                style={{ border: '1px solid rgba(255,255,255,0.1)', height: '48px', color: 'inherit' }}
                            />
                            <button 
                                type="submit"
                                className="btn position-absolute end-0 me-2 p-2 text-primary border-0 bg-transparent"
                                disabled={sending || !input.trim()}
                                style={{ top: '50%', transform: 'translateY(-50%)' }}
                            >
                                <FaPaperPlane style={{ fontSize: '1.2rem' }} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParentAIConsultant;
