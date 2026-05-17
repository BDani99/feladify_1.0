import { API_BASE_URL } from '../config';
import { handleApiError } from '../../utils/apiErrorHandler';

export const sendTutorMessage = async (questionText, correctAnswer, studentAnswer, chatHistory) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/tutor`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ questionText, correctAnswer, studentAnswer, chatHistory }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
};

export const getAnswerExplanation = async (questionText, correctAnswer, studentAnswer) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/explain`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ questionText, correctAnswer, studentAnswer }),
    });
    if (!response.ok) await handleApiError(response);
    return (await response.json()).explanation;
};
