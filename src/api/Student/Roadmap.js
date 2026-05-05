const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`
});

export const fetchRoadmap = async () => {
  console.log('[Roadmap API] Fetching roadmap...');
  try {
    const token = sessionStorage.getItem('AccessToken');
    console.log('[Roadmap API] Token exists:', !!token);
    
    const response = await fetch(`/api/student/roadmap`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    console.log('[Roadmap API] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Roadmap API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt az útvonal lekérésekor`);
    }

    const data = await response.json();
    console.log('[Roadmap API] Success:', data);
    return data;
  } catch (error) {
    console.error('[Roadmap API] fetchRoadmap error:', error);
    throw error;
  }
};

export const submitRoadmapNode = async (nodeId, score, answers = []) => {
  console.log('[Roadmap API] Submitting node:', nodeId, score);
  try {
    const token = sessionStorage.getItem('AccessToken');
    console.log('[Roadmap API] Token exists:', !!token);
    
    const response = await fetch(`/api/student/roadmap/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nodeId, score, answers })
    });

    console.log('[Roadmap API] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Roadmap API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt a beküldéskor`);
    }

    const data = await response.json();
    console.log('[Roadmap API] Success:', data);
    return data;
  } catch (error) {
    console.error('[Roadmap API] submitRoadmapNode error:', error);
    throw error;
  }
};

export const fetchStudentStatistics = async () => {
  console.log('[Roadmap API] Fetching statistics...');
  try {
    const token = sessionStorage.getItem('AccessToken');
    console.log('[Roadmap API] Token exists:', !!token);
    
    const response = await fetch(`/api/student/statistics`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    console.log('[Roadmap API] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Roadmap API] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: Hiba történt a statisztikák lekérésekor`);
    }

    const data = await response.json();
    console.log('[Roadmap API] Success:', data);
    return data;
  } catch (error) {
    console.error('[Roadmap API] fetchStudentStatistics error:', error);
    throw error;
  }
};
