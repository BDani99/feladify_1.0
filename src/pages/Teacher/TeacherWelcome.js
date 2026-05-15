import React, { useState, useEffect, useRef } from 'react';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchChatHistory, sendChatMessage, startNewSession } from '../../api/Teacher/Chat';
import { useTeacherChat } from '../../context/TeacherChatContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Welcome.css';
import logo from '../../assets/logo-400.png';
import { FaPaperPlane, FaPlus, FaHistory, FaTrash, FaPen, FaExclamationCircle } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';

const quickPrompts = [
    "Melyik diákom teljesít a legjobban az osztályban?",
    "Segíts összeállítani egy szorzástábla dolgozatot!",
    "Mi a javasolt nehézségi szint 6. osztálynak?",
    "Hogyan motíváljam a gyengébben teljesítő diákokat?",
    "Milyen visszajelzést adjak egy elégtelen dolgozathoz?",
    "Segíts értékelési szempontokat alkotni irodalomból!"
];

const TeacherWelcome = () => {
    const {
        messages, setMessages,
        sessions, setSessions,
        currentSessionId, setCurrentSessionId,
        chatLoaded, setChatLoaded,
        loadSession, deleteSession, renameSession
    } = useTeacherChat();

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [showSessionHistory, setShowSessionHistory] = useState(false);
    const [renamingSessionId, setRenamingSessionId] = useState(null);
    const [renamingTitle, setRenamingTitle] = useState('');
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchUserData();
                if (response.message === 'Felhasználó adatai sikeresen lekérve') {
                    setUserName(response.user.name);
                }
                const date = new Date();
                setCurrentDate(date.toLocaleDateString('hu-HU', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                }));
            } catch (err) {
                setError('Nem sikerült betölteni az adatokat. Kérjük, próbáld újra.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!chatLoaded) {
            loadChatHistoryFromServer();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatLoaded]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isBotTyping]);

    const loadChatHistoryFromServer = async () => {
        try {
            const data = await fetchChatHistory();
            if (data?.messages) setMessages(data.messages.length > 0 ? data.messages : []);
            if (data?.sessions) setSessions(data.sessions);
            if (data?.currentSessionId) setCurrentSessionId(data.currentSessionId);
            setChatLoaded(true);
        } catch (err) {
            console.error('Hiba a chat előzmények betöltésekor:', err);
            setMessages([]);
            setChatLoaded(true);
        }
    };

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput('');
        setMessages(prev => [...(prev || []), { role: 'user', content: userMsg, timestamp: new Date() }]);
        setIsBotTyping(true);

        try {
            const response = await sendChatMessage(userMsg);
            setMessages(prev => [...(prev || []), {
                role: 'assistant',
                content: response.message,
                timestamp: new Date()
            }]);
            if (response.sessionId && !currentSessionId) {
                setCurrentSessionId(response.sessionId);
                setSessions(prev => {
                    const exists = prev.some(s => s.sessionId === response.sessionId);
                    if (!exists) {
                        return [{ sessionId: response.sessionId, title: 'Jelenlegi beszélgetés', updatedAt: new Date() }, ...prev];
                    }
                    return prev;
                });
            }
        } catch (err) {
            setMessages(prev => [...(prev || []), {
                role: 'assistant',
                content: 'Hiba történt a válasz generálása során.',
                timestamp: new Date()
            }]);
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
            await startNewSession();
        } catch (err) {
            console.error('Hiba új session létrehozásakor:', err);
        }
    };

    const handleLoadSession = async (sessionId) => {
        setShowSessionHistory(false);
        if (sessionId === currentSessionId) return;
        try {
            await loadSession(sessionId);
        } catch (err) {
            setError('Hiba az előzmény betöltésekor.');
        }
    };

    const handleDeleteSession = async (sessionId, e) => {
        e.stopPropagation();
        if (!window.confirm('Biztosan törölni szeretnéd ezt a beszélgetést?')) return;
        try {
            await deleteSession(sessionId);
            if (currentSessionId === sessionId) {
                setMessages([]);
                setCurrentSessionId(null);
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
        if (!renamingTitle.trim()) { setRenamingSessionId(null); return; }
        try {
            await renameSession(sessionId, renamingTitle);
            setRenamingSessionId(null);
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

    return (
        <div id="content" className="teacher-welcome">
            <div className="welcome-container" style={{ position: 'relative' }}>

                <div className="chat-header">
                    <div className="chat-header-info">
                        <h1 className="title">Üdv, {userName || 'Tanár'}! 👋</h1>
                        <p className="date">{currentDate}</p>
                    </div>
                    <div className="chat-header-actions">
                        <button
                            className="header-btn"
                            onClick={() => setShowSessionHistory(!showSessionHistory)}
                            title="Előzmények"
                        >
                            <FaHistory />
                        </button>
                        <button
                            className="header-btn primary"
                            onClick={handleNewChat}
                            title="Új beszélgetés"
                        >
                            <FaPlus /> Új chat
                        </button>
                    </div>
                </div>

                {error && <p className="error-message"><FaExclamationCircle /> {error}</p>}

                {showSessionHistory && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                            onClick={() => setShowSessionHistory(false)}
                        />
                        <div className="session-history-panel">
                            <div className="session-panel-header">
                                <h3>Korábbi beszélgetések</h3>
                            </div>
                            <div className="session-panel-body">
                                {sessions.length === 0 ? (
                                    <p className="session-panel-empty">Nincsenek korábbi beszélgetések</p>
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
                                                    <button
                                                        onClick={(e) => handleStartRename(session, e)}
                                                        className="session-action-btn"
                                                        title="Átnevezés"
                                                    >
                                                        <FaPen />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteSession(session.sessionId, e)}
                                                        className="session-action-btn danger"
                                                        title="Törlés"
                                                    >
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

                <div className="chat-body">
                    {(!messages || messages.length === 0) && !isBotTyping && (
                        <div className="welcome-screen">
                            <div className="welcome-avatar">
                                <img src={logo} alt="AI Asszisztens" />
                            </div>
                            <h2>Miben segíthetek?</h2>
                            <p>Kérdezz bármit az osztályaidról, a diákjaidról, vagy kérj segítséget egy dolgozat elkészítéséhez!</p>
                            <div className="quick-prompts">
                                <p>Gyors kérdések:</p>
                                <div className="prompts-grid">
                                    {quickPrompts.map((prompt, index) => (
                                        <button
                                            key={index}
                                            className="quick-prompt-btn"
                                            onClick={() => handleQuickPrompt(prompt)}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {((messages && messages.length > 0) || isBotTyping) && (
                        <div className="chat-history">
                            {messages && messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`chat-message ${msg.role === 'user' ? 'user' : 'bot'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <img src={logo} alt="AI" className="chat-logo" />
                                    )}
                                    <div className="message-bubble-wrapper">
                                        <div className="message-content">
                                            {msg.role === 'assistant' ? (
                                                <div className="markdown-content">
                                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                </div>
                                            ) : (
                                                <span>{msg.content}</span>
                                            )}
                                        </div>
                                        {msg.role === 'user' && (
                                            <span className="message-time">
                                                {new Date(msg.timestamp).toLocaleTimeString('hu-HU', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
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

                <form onSubmit={handleChatSubmit} className="chat-input-form">
                    <textarea
                        ref={inputRef}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Kérdezz bármit az osztályaidról, diákjaidról..."
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
                    <button type="submit" className="chat-submit" disabled={isBotTyping}>
                        <FaPaperPlane />
                    </button>
                </form>

            </div>
        </div>
    );
};

export default TeacherWelcome;
