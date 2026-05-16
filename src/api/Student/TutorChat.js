import { API_BASE_URL } from '../config';

export const sendTutorMessage = async (questionText, correctAnswer, studentAnswer, chatHistory) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/tutor`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ questionText, correctAnswer, studentAnswer, chatHistory }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a tutor válasz kérésekor.');
    return data;
};

export const getAnswerExplanation = async (questionText, correctAnswer, studentAnswer) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/explain`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ questionText, correctAnswer, studentAnswer }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a magyarázat kérésekor.');
    return data.explanation;
};
