export const fetchTeacherStatistics = async () => {
    try {
        const response = await fetch('/api/assignments//teacher/statistics', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch statistics');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching statistics:', error);
        throw error;
    }
};
