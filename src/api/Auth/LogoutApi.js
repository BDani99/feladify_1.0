import { API_BASE_URL } from '../config';

export const logoutUser = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
            },
        });

        localStorage.removeItem('AccessToken');
        localStorage.removeItem('isLoggedIn');

        if (!response.ok) {
            throw new Error(`Logout failed with status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error during logout:', error);
        throw error;
    }
};
