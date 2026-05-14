import { API_BASE_URL } from '../config';

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('AccessToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const getTutorHint = async (params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/tutor/hint`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt a Szókratészi tipp kérésekor');
    }
    return await response.json();
  } catch (error) {
    console.error('[Tutor API] getTutorHint hiba:', error);
    throw error;
  }
};

export const getPracticeQuestionSet = async (subject, topic, difficulty = 3, count = 3) => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/tutor/question-set`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ subject, topic, difficulty, count })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt a gyakorló feladatsor generálásakor');
    }

    return await response.json();
  } catch (error) {
    console.error('[Tutor API] getPracticeQuestionSet hiba:', error);
    throw error;
  }
};

export const getPracticeQuestion = async (subject, topic) => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/tutor/question`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ subject, topic })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt a kérdés generálásakor');
    }

    return await response.json();
  } catch (error) {
    console.error('[Tutor API] getPracticeQuestion hiba:', error);
    throw error;
  }
};

export const checkAnswer = async (params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/tutor/check`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt a válasz ellenőrzése során');
    }

    return await response.json();
  } catch (error) {
    console.error('[Tutor API] checkAnswer hiba:', error);
    throw error;
  }
};

export const getCheckpointHint = async ({ checkpointId, questionId, studentAnswer, attemptNumber }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/student/checkpoint/hint`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ checkpointId, questionId, studentAnswer, attemptNumber })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hiba történt a tipp kérése során');
    }

    return await response.json();
  } catch (error) {
    console.error('[Tutor API] getCheckpointHint hiba:', error);
    throw error;
  }
};