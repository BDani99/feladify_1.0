export const fetchTeacherClasses = async () => {
    try {
        const response = await fetch('/api/teacher/classes', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
            }
        });

        if (!response.ok) {
            throw new Error('Hiba történt az osztályok lekérése során');
        }

        const data = await response.json();
        return data.classes;
    } catch (error) {
        console.error(error);
        throw new Error('Hiba történt az osztályok lekérése során');
    }
};
