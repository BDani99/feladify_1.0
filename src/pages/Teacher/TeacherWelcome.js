import React, { useState, useEffect } from 'react';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { sendChatMessage } from '../../api/Chat';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaPaperPlane } from 'react-icons/fa';
import '../../styles/Welcome.css';
import logo from '../../assets/logo-400.png';

const TeacherWelcome = () => {
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [classes, setClasses] = useState([]);
    const [currentDate, setCurrentDate] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userResponse = await fetchUserData();

                if (userResponse.message === 'Felhasználó adatai sikeresen lekérve') {
                    setUserName(userResponse.user.name);
                    setMessage('Sikeresen betöltve az adatok!');
                } else {
                    setMessage('Nem található felhasználói adat.');
                }

                const classesData = await fetchTeacherClasses();
                setClasses(classesData);

                const date = new Date();
                setCurrentDate(date.toLocaleDateString('hu-HU', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }));
            } catch (err) {
                setError('Hiba történt az adatok lekérésekor.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleChatInputChange = (e) => {
        setChatInput(e.target.value);
    };

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        setChatHistory(prev => [...prev, { sender: 'user', text: chatInput }]);

        try {
            const responseMessage = await sendChatMessage(chatInput);
            setChatHistory(prev => [...prev, { sender: 'bot', text: responseMessage }]);
            setChatInput('');
        } catch (error) {
            setError(error.message);
        }
    };

    if (loading) {
        return (
            <div id="content">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div id="content">
            <div className="welcome-container">
                <h1 className="title">Üdv, {userName || 'Felhasználó'}!</h1>
                <p className="date">{currentDate}</p>
                {error && <p className="error-message">{error}</p>}
                <div className='chat-container'>
                    <div className="chat-history">
                        {chatHistory.map((chat, index) => (
                            <div key={index} className={`chat-message ${chat.sender}`}>
                                {chat.sender === 'bot' && (
                                    <img src={logo} alt="Logo" className="chat-logo" />
                                )}
                                <div>{chat.text}</div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleChatSubmit} className="chat-input-form">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={handleChatInputChange}
                            placeholder="Írj egy üzenetet..."
                            className="chat-input"
                        />
                        <button type="submit" className="chat-submit">
                            <FaPaperPlane />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TeacherWelcome;
