import React, { createContext, useContext, useState } from 'react';
import { loadChatSession } from '../api/Student/Chat';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatLoaded, setChatLoaded] = useState(false);

  const loadSession = async (sessionId) => {
    const data = await loadChatSession(sessionId);
    setMessages(data.messages);
    setCurrentSessionId(sessionId);
    setSessions(data.sessions);
  };

  return (
    <ChatContext.Provider value={{
      messages,
      setMessages,
      sessions,
      setSessions,
      currentSessionId,
      setCurrentSessionId,
      chatLoaded,
      setChatLoaded,
      loadSession
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
