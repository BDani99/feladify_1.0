import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const overrideScore = async (studentId, assignmentId, questionId, score) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/override-score`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ studentId, assignmentId, questionId, score }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};
