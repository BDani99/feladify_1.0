import { API_BASE_URL } from '../config';
import { handleApiError } from '../../utils/apiErrorHandler';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
});

export const startDiagnosticTest = async (subject) => {
  const response = await fetch(`${API_BASE_URL}/student/diagnostic/start/${subject}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const submitDiagnosticAnswers = async (testId, answers) => {
  const response = await fetch(`${API_BASE_URL}/student/diagnostic/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ testId, answers })
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const getDiagnosticResult = async (resultId) => {
  const response = await fetch(`${API_BASE_URL}/student/diagnostic/result/${resultId}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const getDiagnosticStatus = async (subject) => {
  const response = await fetch(`${API_BASE_URL}/student/diagnostic/status/${subject}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const getAllDiagnosticStatuses = async () => {
  const response = await fetch(`${API_BASE_URL}/student/diagnostic/statuses`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};
