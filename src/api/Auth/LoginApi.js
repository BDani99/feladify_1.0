export const login = async (email, password) => {
    try {
        const response = await fetch('api/auth/login', {
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
