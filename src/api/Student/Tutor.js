const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`
});

export const getTutorHint = async (params) => {
  const response = await fetch(`${API_BASE_URL}/student/tutor/hint`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Hiba történt a tipp kérésekor');
  }
  return await response.json();
};

export const getPracticeQuestion = async (subject, topic) => {
  const response = await fetch(`${API_BASE_URL}/student/tutor/question`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ subject, topic })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Hiba történt a kérdés generálásakor');
  }
  return await response.json();
};

export const checkAnswer = async (params) => {
  const response = await fetch(`${API_BASE_URL}/student/tutor/check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Hiba történt az ellenőrzés során');
  }
  return await response.json();
};
