import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const finalizeGrade = async (studentId, assignmentId, grade) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/finalize-grade`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ studentId, assignmentId, grade }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};
