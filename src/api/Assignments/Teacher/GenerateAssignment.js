export const generateAssignment = async (title, subject, difficulty, className, questionCount) => {
    
    console.log(className)
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
                questionCount
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.log("Hiba a válaszban:", data);
            throw new Error(data.message || 'Hiba történt a dolgozat generálása során.');
        }

        console.log("Sikeres válasz:", data);

        return data;
    } catch (error) {
        console.error('Hiba az API hívás során:', error);
        throw error;
    }
};
