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
  try {
    const response = await fetch(`/api/student/chat/history`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Chat API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt a chat előzmények lekérésekor`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Chat API] fetchChatHistory error:', error);
    throw error;
  }
};

export const sendChatMessage = async (message) => {
  try {
    const response = await fetch(`/api/student/chat/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message })
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Chat API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt az üzenet küldése során`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Chat API] sendChatMessage error:', error);
    throw error;
  }
};

export const loadChatSession = async (sessionId) => {
  try {
    const response = await fetch(`/api/student/chat/load-session`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sessionId })
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Chat API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt az előzmény betöltésekor`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Chat API] loadChatSession error:', error);
    throw error;
  }
};
