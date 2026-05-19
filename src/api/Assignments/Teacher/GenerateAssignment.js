import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const previewAssignment = async (title, subject, difficulty, className, questionTypes, selectedTopics) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/preview`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ title, subject, difficulty, className, questionTypes, selectedTopics }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};

export const saveAssignment = async (title, subject, difficulty, className, questions, timeLimit, startDate, dueDate, studentIds) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ title, subject, difficulty, className, questions, timeLimit, startDate, dueDate, studentIds }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};
