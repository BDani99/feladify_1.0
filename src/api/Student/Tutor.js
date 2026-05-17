import { API_BASE_URL } from '../config';
import { handleApiError } from '../../utils/apiErrorHandler';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
});

export const getTutorHint = async (params) => {
  const response = await fetch(`${API_BASE_URL}/student/tutor/hint`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params)
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const getPracticeQuestionSet = async (subject, topic, difficulty = 3, count = 3) => {
  const response = await fetch(`${API_BASE_URL}/student/tutor/question-set`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ subject, topic, difficulty, count })
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const getPracticeQuestion = async (subject, topic) => {
  const response = await fetch(`${API_BASE_URL}/student/tutor/question`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ subject, topic })
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const checkAnswer = async (params) => {
  const response = await fetch(`${API_BASE_URL}/student/tutor/check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params)
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const getCheckpointHint = async ({ checkpointId, questionId, studentAnswer, attemptNumber }) => {
  const response = await fetch(`${API_BASE_URL}/student/checkpoint/hint`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ checkpointId, questionId, studentAnswer, attemptNumber })
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};
