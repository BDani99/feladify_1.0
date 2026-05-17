import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const fetchAssignments = async () => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/list`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) await handleApiError(response);
    return (await response.json()).assignments;
};
