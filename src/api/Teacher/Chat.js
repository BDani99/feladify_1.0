export const sendChatMessage = async (message) => {
    try {
        const response = await fetch('/api/assignments/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            const { message: errorMessage } = await response.json();
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data.message;
    } catch (error) {
        throw new Error('Hiba történt a chat üzenet küldése során: ' + error.message);
    }
};
