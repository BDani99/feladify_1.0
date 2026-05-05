export const sendTutorMessage = async (questionText, correctAnswer, studentAnswer, chatHistory) => {
    const response = await fetch('/api/assignments/student/tutor', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
        body: JSON.stringify({ questionText, correctAnswer, studentAnswer, chatHistory }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Hiba a tutor válasz kérésekor.');
    return data;
};
