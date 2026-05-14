import { API_BASE_URL } from '../config';

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('AccessToken');
  if (!token) {
    console.error('[API] Hiányzó AccessToken a sessionStorage-ből!');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const fetchPracticePath = async (subject) => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/practice?subject=${encodeURIComponent(subject)}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt az egyéni gyakorlóút lekérésekor');
    }

    return await response.json();
  } catch (error) {
    console.error('[Roadmap API] fetchPracticePath hiba:', error);
    throw error;
  }
};

export const submitPracticeCheckpoint = async ({ subject, checkpointId, score, answers }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/practice/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ subject, checkpointId, score, answers })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt a feladat beküldésekor');
    }

    return await response.json();
  } catch (error) {
    console.error('[Roadmap API] submitPracticeCheckpoint hiba:', error);
    throw error;
  }
};

export const fetchStudentStatistics = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/statistics`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt a statisztikák lekérésekor');
    }

    return await response.json();
  } catch (error) {
    console.error('[Roadmap API] fetchStudentStatistics hiba:', error);
    throw error;
  }
};
