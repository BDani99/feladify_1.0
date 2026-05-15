import React, { createContext, useContext, useState } from 'react';
import { loadChatSession, deleteSession as deleteSessionAPI, renameSession as renameSessionAPI } from '../api/Teacher/Chat';

const TeacherChatContext = createContext(null);

export const TeacherChatProvider = ({ children }) => {
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
    <TeacherChatContext.Provider value={{
      messages, setMessages,
      sessions, setSessions,
      currentSessionId, setCurrentSessionId,
      chatLoaded, setChatLoaded,
      loadSession, deleteSession, renameSession
    }}>
      {children}
    </TeacherChatContext.Provider>
  );
};

export const useTeacherChat = () => {
  const context = useContext(TeacherChatContext);
  if (!context) throw new Error('useTeacherChat must be used within TeacherChatProvider');
  return context;
};
