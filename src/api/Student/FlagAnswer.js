import { API_BASE_URL } from '../config';
import { handleApiError } from '../../utils/apiErrorHandler';

export const flagAnswer = async (assignmentId, questionId) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/flag-answer`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ assignmentId, questionId }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};
