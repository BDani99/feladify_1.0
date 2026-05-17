import { API_BASE_URL } from '../config';
import { handleApiError } from '../../utils/apiErrorHandler';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
});

export const fetchAllClasses = async () => {
  const response = await fetch(`${API_BASE_URL}/classes`, { headers: getAuthHeaders() });
  if (!response.ok) await handleApiError(response);
  return (await response.json()).classes;
};

export const createClass = async (name) => {
  const response = await fetch(`${API_BASE_URL}/classes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};

export const updateTeacherClasses = async (classIds) => {
  const response = await fetch(`${API_BASE_URL}/teacher/update-classes`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ classIds }),
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};
