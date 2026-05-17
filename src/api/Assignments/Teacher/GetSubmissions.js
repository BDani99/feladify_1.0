import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const fetchAssignmentSubmissions = async (assignmentId) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/assignment-submissions/${assignmentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};
