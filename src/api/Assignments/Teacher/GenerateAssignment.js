export const generateAssignment = async (title, subject, difficulty, className, questionTypes) => {
    try {
        const response = await fetch('/api/assignments/teacher/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
            },
            body: JSON.stringify({
                title,
                subject,
                difficulty,
                className,
                questionTypes,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.log("Hiba a válaszban:", data);
            throw new Error(data.message || 'Hiba történt a dolgozat generálása során.');
        }

        return data;
    } catch (error) {
        console.error('Hiba az API hívás során:', error);
        throw error;
    }
};

export const previewAssignment = async (title, subject, difficulty, className, questionTypes) => {
    const response = await fetch('/api/assignments/teacher/preview', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ title, subject, difficulty, className, questionTypes }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a generálás során.');
    return data;
};

export const saveAssignment = async (title, subject, difficulty, className, questions, timeLimit, startDate, dueDate) => {
    const response = await fetch('/api/assignments/teacher/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ title, subject, difficulty, className, questions, timeLimit, startDate, dueDate }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a mentés során.');
    return data;
};
