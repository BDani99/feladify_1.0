export const submitAssignment = async (assignmentId, answers) => {
    try {
        const response = await fetch(`/api/assignments/student/submit/${assignmentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
            },
            body: JSON.stringify({ answers }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Hiba történt a dolgozat beküldése során.');
        }

        return data;
    } catch (error) {
        throw new Error(error.message);
    }
};
