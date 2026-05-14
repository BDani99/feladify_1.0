import { API_BASE_URL } from '../../config';

export const previewAssignment = async (title, subject, difficulty, className, questionTypes) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/preview`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ title, subject, difficulty, className, questionTypes }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a generálás során.');
    return data;
};

export const saveAssignment = async (title, subject, difficulty, className, questions, timeLimit, startDate, dueDate) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ title, subject, difficulty, className, questions, timeLimit, startDate, dueDate }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a mentés során.');
    return data;
};
