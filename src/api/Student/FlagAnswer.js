import { API_BASE_URL } from '../config';

export const flagAnswer = async (assignmentId, questionId) => {
    const response = await fetch(`${API_BASE_URL}/assignments/student/flag-answer`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ assignmentId, questionId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a jelzés küldésekor.');
    return data;
};
