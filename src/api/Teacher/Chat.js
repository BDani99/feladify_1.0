import { API_BASE_URL } from '../config';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`
});

const handleUnauthorized = () => {
  sessionStorage.removeItem('AccessToken');
  sessionStorage.removeItem('isLoggedIn');
  window.location.href = '/bejelentkezes';
};

export const fetchChatHistory = async () => {
  const response = await fetch(`${API_BASE_URL}/assignments/teacher/chat/history`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (response.status === 401) { handleUnauthorized(); return; }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

export const sendChatMessage = async (message) => {
  const response = await fetch(`${API_BASE_URL}/assignments/teacher/chat/send`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message })
  });
  if (response.status === 401) { handleUnauthorized(); return; }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${response.status}`);
  }
  return response.json();
};

export const loadChatSession = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/assignments/teacher/chat/load-session`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId })
  });
  if (response.status === 401) { handleUnauthorized(); return; }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

export const deleteSession = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/assignments/teacher/chat/session/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (response.status === 401) { handleUnauthorized(); return; }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

export const renameSession = async (sessionId, title) => {
  const response = await fetch(`${API_BASE_URL}/assignments/teacher/chat/session/${sessionId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title })
  });
  if (response.status === 401) { handleUnauthorized(); return; }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

export const startNewSession = async () => {
  const response = await fetch(`${API_BASE_URL}/assignments/teacher/chat/new-session`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (response.status === 401) { handleUnauthorized(); return; }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
