import { API_BASE_URL } from '../config';
import { handleApiError } from '../../utils/apiErrorHandler';

export const updateProfile = async (profileData) => {
  const response = await fetch(`${API_BASE_URL}/auth/update-profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
    },
    body: JSON.stringify(profileData),
  });
  if (!response.ok) await handleApiError(response);
  return response.json();
};
