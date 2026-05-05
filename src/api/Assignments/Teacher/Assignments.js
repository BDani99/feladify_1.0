export const fetchAssignments = async () => {
    try {
        const response = await fetch('/api/assignments/teacher/list', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('A dolgozatok lekérdezése nem sikerült');
        }

        const data = await response.json();
        return data.assignments;
    } catch (error) {
        console.error(error);
        throw error;
    }
};
