import React, { useState, useEffect, useRef } from 'react';
import { fetchUserData } from '../../api/Auth/ProfileData';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Welcome.css';
import logo from '../../assets/logo-400.png';
import { FaPaperPlane, FaPlus, FaHistory, FaTrash, FaPen, FaExclamationCircle, FaRobot, FaGraduationCap, FaChevronDown } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import ConfirmModal from '../../components/ConfirmModal';

const ParentAIConsultant = () => {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({ isOpen: false, sessionId: null });
  const [selectedModel, setSelectedModel] = useState({ provider: 'deepseek', model: 'dpv4pro' });
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [childSelectOpen, setChildSelectOpen] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const modelPickerRef = useRef(null);
  const childSelectRef = useRef(null);

  const ALL_MODELS = [
    { label: 'DeepSeek v4 Pro',   value: 'dpv4pro',         provider: 'deepseek', badge: 'DeepSeek' },
    { label: 'DeepSeek v4 Flash', value: 'v4flash',         provider: 'deepseek', badge: 'DeepSeek' },
    { label: 'Qwen 3.5 Plus',     value: 'qwen-3.5-plus',   provider: 'qwen',     badge: 'Qwen' },
    { label: 'Qwen 3.5 Flash',    value: 'qwen-3.5-flash',  provider: 'qwen',     badge: 'Qwen' },
  ];

  const quickPrompts = [
    "Hol tart most gyermekem a tanulásban?",
    "Magyarázd el az összeadást és kivonást otthoni példákkal!",
    "Hogyan tudok segíteni a fejlesztendő területeken?",
    "Adj ötleteket játékos matek gyakorláshoz otthon!",
    "Hogyan segíthetek az olvasás fejlesztésében?",
    "Írj egy heti otthoni gyakorlási tervet!"
  ];

  useEffect(() => {
    const handler = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setShowModelPicker(false);
      }
      if (childSelectRef.current && !childSelectRef.current.contains(e.target)) {
        setChildSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [profileRes, childrenRes] = await Promise.all([
          fetchUserData(),
          fetch('/api/parent/children', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
          })
        ]);

        if (profileRes.message === 'Felhasználó adatai sikeresen lekérve') {
          setUserName(profileRes.user.name);
        }
        const date = new Date();
        setCurrentDate(date.toLocaleDateString('hu-HU', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }));

        if (childrenRes.ok) {
          const data = await childrenRes.json();
          if (data.children && data.children.length > 0) {
            setChildren(data.children);
            const stored = localStorage.getItem('parent-selected-child');
            if (!stored || !data.children.some(c => c._id === stored)) {
              setSelectedChildId(data.children[0]._id);
              localStorage.setItem('parent-selected-child', data.children[0]._id);
            }
          }
        }
      } catch (err) {
        setError('Nem sikerült betölteni az adatokat.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    loadChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  const loadChatHistory = async () => {
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
    }
  };

  const handleChildChange = (id) => {
    setSelectedChildId(id);
    localStorage.setItem('parent-selected-child', id);
    setChildSelectOpen(false);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedChildId) return;

    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...(prev || []), { role: 'user', content: userMsg, timestamp: new Date() }]);
    setIsBotTyping(true);

    try {
      setMessages(prev => [...(prev || []), { role: 'assistant', content: '', timestamp: new Date() }]);

      const response = await fetch('/api/parent/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
        },
        body: JSON.stringify({ message: userMsg, childId: selectedChildId, stream: true, modelOverride: selectedModel })
      });

      if (!response.ok) throw new Error('Hálózati hiba történt.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';
      let startedStreaming = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;
          if (cleaned.startsWith('data: ')) {
            try {
              const data = JSON.parse(cleaned.slice(6));
              if (data.chunk) {
                if (!startedStreaming) {
                  startedStreaming = true;
                  setIsBotTyping(false);
                }
                setMessages(prev => {
                  const copy = [...prev];
                  const lastMsg = copy[copy.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    copy[copy.length - 1] = { ...lastMsg, content: lastMsg.content + data.chunk };
                  }
                  return copy;
                });
              } else if (data.done) {
                if (data.sessionId && !currentSessionId) {
                  setCurrentSessionId(data.sessionId);
                  setSessions(prev => {
                    const exists = prev.some(s => s.sessionId === data.sessionId);
                    if (!exists) {
                      return [{ sessionId: data.sessionId, title: 'Jelenlegi konzultáció', updatedAt: new Date() }, ...prev];
                    }
                    return prev;
                  });
                }
              }
            } catch (err) { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const copy = [...prev];
        const lastMsg = copy[copy.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) copy.pop();
        return [...copy, { role: 'assistant', content: 'Hiba történt a válasz generálása során.', timestamp: new Date() }];
      });
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleQuickPrompt = (prompt) => {
    setChatInput(prompt);
    inputRef.current?.focus();
  };

  const handleNewChat = async () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowSessionHistory(false);
    try {
      await fetch('/api/parent/chat/new-session', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadSession = async (sessionId) => {
    setShowSessionHistory(false);
    if (sessionId === currentSessionId) return;
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
      setError('Hiba az előzmény betöltésekor.');
    }
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    setConfirmDeleteModal({ isOpen: true, sessionId });
  };

  const executeDeleteSession = async () => {
    const sessionId = confirmDeleteModal.sessionId;
    setConfirmDeleteModal({ isOpen: false, sessionId: null });
    if (!sessionId) return;
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
      setError('Hiba a session törlése során.');
    }
  };

  const handleStartRename = (session, e) => {
    e.stopPropagation();
    setRenamingSessionId(session.sessionId);
    setRenamingTitle(session.title);
  };

  const handleRenameSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!renamingTitle.trim()) {
      setRenamingSessionId(null);
      return;
    }
    try {
      const res = await fetch(`/api/parent/chat/session/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
        },
        body: JSON.stringify({ title: renamingTitle.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setRenamingSessionId(null);
      }
    } catch (err) {
      setError('Hiba a session név módosítása során.');
    }
  };

  const handleRenameKeyPress = (sessionId, e) => {
    if (e.key === 'Enter') handleRenameSession(sessionId, e);
    else if (e.key === 'Escape') setRenamingSessionId(null);
  };

  if (loading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div id="content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <FaGraduationCap style={{ fontSize: '3.5rem', color: 'var(--accent)', marginBottom: 24 }} />
            <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Nincs még összekapcsolt gyermek</h2>
            <p style={{ color: 'var(--color-text-dim)' }}>Az AI tanácsadó használatához adj hozzá egy gyermeket a Beállítások menüben.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="content" className="parent-welcome">
      <div className="welcome-container" style={{ position: 'relative' }}>

        {/* Header */}
        <div className="page-header-banner" style={{ margin: '18px 40px 12px 40px', background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }}>
          <div className="phb-icon" style={{ width: 48, height: 48, padding: 0, overflow: 'hidden', background: 'none', border: 'none' }}>
            <img src={logo} alt="Feladify" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="phb-text">
            <h1 className="phb-title">Szia, {userName || 'Szülő'}!</h1>
            <p className="phb-subtitle">{currentDate}</p>
          </div>
          <div className="chat-header-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Child selector */}
            {children.length > 0 && (
              <div ref={childSelectRef} style={{ position: 'relative', minWidth: 150 }}>
                <div
                  className={`custom-select-trigger has-value${childSelectOpen ? ' open' : ''}`}
                  style={{ height: 36, padding: '0 12px', fontSize: '0.9rem' }}
                  onClick={() => setChildSelectOpen(!childSelectOpen)}
                >
                  <div className="trigger-content">
                    <span style={{ fontWeight: 700 }}>
                      {children.find(c => c._id === selectedChildId)?.name || 'Gyermek'}
                    </span>
                  </div>
                  <FaChevronDown className="select-chevron" />
                </div>
                {childSelectOpen && (
                  <div className="custom-select-options" style={{ width: 'max-content', maxWidth: 280 }}>
                    {children.map(c => (
                      <div
                        key={c._id}
                        className={`custom-select-option${c._id === selectedChildId ? ' selected' : ''}`}
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={() => handleChildChange(c._id)}
                      >
                        {c.name}{c.className ? ` (${c.className})` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className="header-btn" onClick={() => setShowSessionHistory(!showSessionHistory)} title="Előzmények">
              <FaHistory />
            </button>
            <button className="header-btn primary" onClick={handleNewChat} title="Új konzultáció">
              <FaPlus /> Új konzultáció
            </button>
          </div>
        </div>

        {error && <p className="error-message"><FaExclamationCircle />{error}</p>}

        {/* Session History Panel */}
        {showSessionHistory && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setShowSessionHistory(false)} />
            <div className="session-history-panel">
              <div className="session-panel-header">
                <h3>Korábbi konzultációk</h3>
              </div>
              <div className="session-panel-body">
                {sessions.length === 0 ? (
                  <p className="session-panel-empty">Nincsenek korábbi konzultációk</p>
                ) : (
                  sessions.map((session) => (
                    <li
                      key={session.sessionId}
                      onClick={() => handleLoadSession(session.sessionId)}
                      className={`session-item${session.sessionId === currentSessionId ? ' active' : ''}`}
                    >
                      <div className="session-item-header">
                        <div className="session-item-title-row">
                          {renamingSessionId === session.sessionId ? (
                            <input
                              type="text"
                              value={renamingTitle}
                              onChange={(e) => setRenamingTitle(e.target.value)}
                              onBlur={(e) => handleRenameSession(session.sessionId, e)}
                              onKeyDown={(e) => handleRenameKeyPress(session.sessionId, e)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="session-rename-input"
                            />
                          ) : (
                            <>
                              <span className="session-item-title">{session.title}</span>
                              {session.sessionId === currentSessionId && (
                                <span className="session-current-badge">Jelenlegi</span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="session-item-actions">
                          <button onClick={(e) => handleStartRename(session, e)} className="session-action-btn" title="Átnevezés">
                            <FaPen />
                          </button>
                          <button onClick={(e) => handleDeleteSession(session.sessionId, e)} className="session-action-btn danger" title="Törlés">
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                      <span className="session-item-date">
                        {new Date(session.updatedAt).toLocaleDateString('hu-HU', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </span>
                    </li>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Chat Body */}
        <div className="chat-body">
          {(!messages || messages.length === 0) && !isBotTyping && (
            <div className="welcome-screen">
              <div className="welcome-avatar">
                <img src={logo} alt="AI Tanácsadó" />
              </div>
              <h2>AI Tanár – {children.find(c => c._id === selectedChildId)?.name || 'Gyermeked'} oktatója</h2>
              <p>Kérdezz a gyermeked tanulási haladásáról, kérj magyarázatot egy tantárgyhoz, vagy ötleteket otthoni gyakorláshoz!</p>
              <div className="quick-prompts">
                <p>Gyors kérdések:</p>
                <div className="prompts-grid">
                  {quickPrompts.map((prompt, index) => (
                    <button key={index} className="quick-prompt-btn" onClick={() => handleQuickPrompt(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {((messages && messages.length > 0) || isBotTyping) && (
            <div className="chat-history">
              {messages && messages.map((chat, index) => {
                if (isBotTyping && chat.role === 'assistant' && chat.content === '') return null;
                return (
                  <div key={index} className={`chat-message ${chat.role === 'user' ? 'user' : 'bot'}`}>
                    {chat.role === 'assistant' && (
                      <img src={logo} alt="AI" className="chat-logo" />
                    )}
                    <div className="message-bubble-wrapper">
                      <div className="message-content">
                        {chat.role === 'assistant' ? (
                          <div className="markdown-content">
                            <ReactMarkdown>{chat.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <span>{chat.content}</span>
                        )}
                      </div>
                      {chat.role === 'user' && (
                        <span className="message-time">
                          {new Date(chat.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {isBotTyping && (
                <div className="chat-message bot">
                  <img src={logo} alt="Logo" className="chat-logo" />
                  <div className="message-bubble-wrapper">
                    <div className="message-content thinking-bubble">
                      <span className="thinking-label">Gondolkodom</span>
                      <div className="typing-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleChatSubmit} className="chat-input-form">
          <div className="chat-input-wrapper" ref={modelPickerRef}>
            {showModelPicker && (
              <div className="model-picker-popup">
                {ALL_MODELS.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`model-picker-item ${selectedModel?.model === m.value ? 'active' : ''}`}
                    onClick={() => { setSelectedModel({ provider: m.provider, model: m.value }); setShowModelPicker(false); }}
                  >
                    {m.badge && <span className={`model-badge model-badge-${m.provider}`}>{m.badge}</span>}
                    <span className="model-name">{m.label}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className={`model-picker-btn ${showModelPicker ? 'model-open' : ''}`}
              onClick={() => setShowModelPicker(v => !v)}
              title={selectedModel.model}
            >
              <FaRobot />
            </button>
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Írd le a kérdésed gyermeked tanulásával kapcsolatban..."
              className="chat-input"
              disabled={isBotTyping}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit(e);
                }
              }}
            />
            <button type="submit" className="chat-submit" disabled={isBotTyping || !chatInput.trim()}>
              <FaPaperPlane />
            </button>
          </div>
          <p className="model-active-note">Modell: <strong>{ALL_MODELS.find(m => m.value === selectedModel.model)?.label || selectedModel.model}</strong></p>
          <p className="chat-footer-note">A Feladify AI hibázhat. Ellenőrizd a fontos információkat.</p>
        </form>

        <ConfirmModal
          isOpen={confirmDeleteModal.isOpen}
          title="Konzultáció törlése"
          message="Biztosan törölni szeretnéd ezt a konzultációt?"
          confirmText="Törlés"
          cancelText="Mégse"
          type="danger"
          onConfirm={executeDeleteSession}
          onCancel={() => setConfirmDeleteModal({ isOpen: false, sessionId: null })}
        />
      </div>
    </div>
  );
};

export default ParentAIConsultant;
