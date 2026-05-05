const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`
});

export const fetchChatHistory = async () => {
  console.log('[Chat API] Fetching chat history...');
  try {
    const token = sessionStorage.getItem('AccessToken');
    console.log('[Chat API] Token exists:', !!token);
    
    const response = await fetch(`/api/student/chat/history`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    console.log('[Chat API] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Chat API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt a chat előzmények lekérésekor`);
    }

    const data = await response.json();
    console.log('[Chat API] Success:', data);
    return data;
  } catch (error) {
    console.error('[Chat API] fetchChatHistory error:', error);
    throw error;
  }
};

export const sendChatMessage = async (message) => {
  console.log('[Chat API] Sending message:', message.substring(0, 50) + '...');
  try {
    const token = sessionStorage.getItem('AccessToken');
    console.log('[Chat API] Token exists:', !!token);
    
    const response = await fetch(`/api/student/chat/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message })
    });

    console.log('[Chat API] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Chat API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt az üzenet küldése során`);
    }

    const data = await response.json();
    console.log('[Chat API] Success:', data);
    return data;
  } catch (error) {
    console.error('[Chat API] sendChatMessage error:', error);
    throw error;
  }
};
