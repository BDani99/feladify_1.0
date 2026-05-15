import { API_BASE_URL } from '../../config';

export const finalizeGrade = async (studentId, assignmentId, grade) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/finalize-grade`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ studentId, assignmentId, grade }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba az osztályzat véglegesítésekor.');
    return data;
};
