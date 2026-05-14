import { API_BASE_URL } from '../config';

export const login = async (email, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Hiba történt a bejelentkezés során.');
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Hiba az API hívás során:', error);
        throw error;
    }
};
