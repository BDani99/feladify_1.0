import { API_BASE_URL } from '../../config';
import { handleApiError } from '../../../utils/apiErrorHandler';

export const fetchFlaggedAnswers = async () => {
    const res = await fetch(`${API_BASE_URL}/assignments/teacher/flagged-answers`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
        },
    });
    if (!res.ok) await handleApiError(res);
    return res.json();
};
