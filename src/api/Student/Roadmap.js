import { API_BASE_URL } from '../config';
import { handleApiError } from '../../utils/apiErrorHandler';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
});

export const fetchPracticePath = async (subject) => {
  const response = await fetch(`${API_BASE_URL}/student/practice?subject=${encodeURIComponent(subject)}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const submitPracticeCheckpoint = async ({ subject, checkpointId, score, answers }) => {
  const response = await fetch(`${API_BASE_URL}/student/practice/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ subject, checkpointId, score, answers })
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const fetchPracticeStatistics = async () => {
  const response = await fetch(`${API_BASE_URL}/student/practice-statistics`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const fetchStudentStatistics = async () => {
  const response = await fetch(`${API_BASE_URL}/student/statistics`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};
