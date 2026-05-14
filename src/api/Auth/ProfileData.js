import { API_BASE_URL } from '../config';

export const fetchUserData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/data`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
            },
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
};
