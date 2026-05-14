import { API_BASE_URL } from '../../config';

export const overrideScore = async (studentId, assignmentId, questionId, score) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/override-score`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ studentId, assignmentId, questionId, score }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a pontszám felülírásakor.');
    return data;
};
