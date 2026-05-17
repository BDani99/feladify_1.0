import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const updateQuestion = async (assignmentId, questionId, updatedFields) => {
    const res = await fetch(`${API_BASE_URL}/assignments/teacher/update-question`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ assignmentId, questionId, ...updatedFields }),
    });
    if (!res.ok) await handleApiError(res);
    return res.json();
};
