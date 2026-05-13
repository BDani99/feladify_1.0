import React, { useState, useEffect, useRef } from 'react';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchChatHistory, sendChatMessage } from '../../api/Student/Chat';
import { useChat } from '../../context/ChatContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Welcome.css';
import logo from '../../assets/logo-400.png';
import { FaPaperPlane, FaPlus, FaHistory } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';

const StudentWelcome = () => {
  const { messages, setMessages, sessions, setSessions, currentSessionId, setCurrentSessionId, chatLoaded, setChatLoaded, loadSession } = useChat();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const quickPrompts = [
    "Milyen dolgozataim lesznek a héten?",
    "Kérdezz ki a leggyengébb témakörömből!",
    "Magyarázd el a Pitagorasz-tételt!",
    "Hogyan javíthatom a matek átlagomat?"
  ];

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
        setError('Hiba történt az adatok lekérésekor.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!chatLoaded) {
      loadChatHistory();
    }
  }, [chatLoaded]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  const loadChatHistory = async () => {
    try {
      const data = await fetchChatHistory();
      if (data.messages) {
        setMessages(data.messages.length > 0 ? data.messages : []);
      }
      if (data.sessions) setSessions(data.sessions);
      if (data.currentSessionId) setCurrentSessionId(data.currentSessionId);
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
      await fetch('/api/student/chat/new-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`
        }
      });
    } catch (err) {
      console.error('Hiba új session létrehozásakor:', err);
    }
  };

  const handleLoadSession = async (sessionId) => {
    setShowSessionHistory(false);
    try {
      await loadSession(sessionId);
    } catch (err) {
      setError('Hiba az előzmény betöltésekor.');
    }
  };

  if (loading) {
    return (
      <div id="content">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div id="content" className="student-welcome">
      <div className="welcome-container" style={{ position: 'relative' }}>

        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <h1 className="title">Szia, {userName || 'Felhasználó'}! 👋</h1>
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

        {error && <p className="error-message">{error}</p>}

        {/* Session History Panel */}
        {showSessionHistory && (
          <>
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 199
              }}
              onClick={() => setShowSessionHistory(false)}
            />
            <div className="session-history-panel">
              <h3>Előzmények</h3>
              {sessions.length === 0 ? (
                <p style={{ color: 'var(--color-text-dim)', fontSize: '13px' }}>Nincsenek korábbi beszélgetések</p>
              ) : (
                <ul>
                  {sessions.map((session) => (
                    <li
                      key={session.sessionId}
                      onClick={() => handleLoadSession(session.sessionId)}
                      className={session.sessionId === currentSessionId ? 'active' : ''}
                    >
                      <span className="session-title">{session.title}</span>
                      <span className="session-date">
                        {new Date(session.updatedAt).toLocaleDateString('hu-HU')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Chat Body */}
        <div className="chat-body">
          {/* Welcome Screen (no messages) */}
          {(!messages || messages.length === 0) && !isBotTyping && (
            <div className="welcome-screen">
              <div className="welcome-avatar">
                <img src={logo} alt="AI Tanár" />
              </div>
              <h2>Üdvözöllek a Feladify AI Tanárodnál!</h2>
              <p>Kérdezz bátran bármilyen tantárggyal kapcsolatban, vagy kérj segítséget a tanuláshoz!</p>
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

          {/* Chat Messages */}
          {((messages && messages.length > 0) || isBotTyping) && (
            <div className="chat-history">
              {messages && messages.map((chat, index) => (
                <div
                  key={index}
                  className={`chat-message ${chat.role === 'user' ? 'user' : 'bot'}`}
                >
                  {chat.role === 'assistant' && (
                    <img src={logo} alt="AI" className="chat-logo" />
                  )}
                  <div className="message-content">
                    {chat.role === 'assistant' ? (
                      <div className="markdown-content">
                        <ReactMarkdown>{chat.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span>{chat.content}</span>
                    )}
                    <span className="message-time">
                      {new Date(chat.timestamp).toLocaleTimeString('hu-HU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
              {isBotTyping && (
                <div className="chat-message bot">
                  <img src={logo} alt="Logo" className="chat-logo" />
                  <div className="message-content">
                    <div className="typing-dots">
                      <span></span><span></span><span></span>
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
          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Írj egy üzenetet..."
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

export default StudentWelcome;
