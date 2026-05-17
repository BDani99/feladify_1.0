import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const fetchTeacherStatistics = async () => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/statistics`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};
