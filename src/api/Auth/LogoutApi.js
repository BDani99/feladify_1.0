export const logoutUser = async () => {
    try {
        const response = await fetch('api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Logout failed with status: ${response.status}`);
        }

        sessionStorage.removeItem('AccessToken');
        sessionStorage.removeItem('isLoggedIn');

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error during logout:', error);
        throw error;
    }
};
