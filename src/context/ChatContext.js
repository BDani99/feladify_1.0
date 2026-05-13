import React, { createContext, useContext, useState } from 'react';
import { loadChatSession, deleteSession as deleteSessionAPI, renameSession as renameSessionAPI } from '../api/Student/Chat';

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

  const deleteSession = async (sessionId) => {
    const data = await deleteSessionAPI(sessionId);
    setSessions(data.sessions);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  };

  const renameSession = async (sessionId, title) => {
    const data = await renameSessionAPI(sessionId, title);
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
      loadSession,
      deleteSession,
      renameSession
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
