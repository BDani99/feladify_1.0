import React, { createContext, useContext, useState } from 'react';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatLoaded, setChatLoaded] = useState(false);

  return (
    <ChatContext.Provider value={{
      messages,
      setMessages,
      sessions,
      setSessions,
      currentSessionId,
      setCurrentSessionId,
      chatLoaded,
      setChatLoaded
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
