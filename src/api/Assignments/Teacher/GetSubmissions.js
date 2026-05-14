import { API_BASE_URL } from '../../config';

export const fetchAssignmentSubmissions = async (assignmentId) => {
    const response = await fetch(`${API_BASE_URL}/assignments/teacher/assignment-submissions/${assignmentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a beküldések lekérésekor.');
    return data;
};
