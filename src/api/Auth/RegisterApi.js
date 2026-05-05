export const registerUser = async (userData) => {
    try {
        const response = await fetch('api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Hiba történt a regisztráció során.');
        }
        return data;
    } catch (error) {
        console.error('Hiba az API hívás során:', error);
        throw error;
    }
};
