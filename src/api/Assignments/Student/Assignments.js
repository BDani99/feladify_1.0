import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const fetchAvailableAssignments = async () => {
  const response = await fetch(`${API_BASE_URL}/assignments/student/available-assignments`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
    },
  });
  if (!response.ok) await handleApiError(response);
  return (await response.json()).assignments;
};

export const fetchCompletedAssignments = async () => {
  const response = await fetch(`${API_BASE_URL}/assignments/student/completed-assignments`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
    },
  });
  if (!response.ok) await handleApiError(response);
  return (await response.json()).assignments;
};
