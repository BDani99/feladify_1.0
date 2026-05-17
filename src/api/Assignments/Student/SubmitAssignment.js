import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const submitAssignment = async (assignmentId, answers) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/submit/${assignmentId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ answers }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};

export const autosaveAssignment = async (assignmentId, answers) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/autosave/${assignmentId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ answers }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};
