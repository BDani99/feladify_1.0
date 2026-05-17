import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const resolveFlaggedAnswer = async (studentId, assignmentId, questionId, response, rejected) => {
    const res = await fetch(`${API_BASE_URL}/assignments/teacher/resolve-flag`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ studentId, assignmentId, questionId, response, rejected }),
    });
    if (!res.ok) await handleApiError(res);
    return res.json();
};
