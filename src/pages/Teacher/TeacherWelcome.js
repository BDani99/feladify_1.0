import React, { useState, useEffect, useRef } from 'react';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { sendChatMessage } from '../../api/Chat';
import LoadingSpinner from '../../components/LoadingSpinner';
import { FaPaperPlane } from 'react-icons/fa';
import '../../styles/Welcome.css';
import logo from '../../assets/logo-400.png';

const TeacherWelcome = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isBotTyping, setIsBotTyping] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userResponse = await fetchUserData();
                if (userResponse.message === 'Felhasználó adatai sikeresen lekérve') {
                    setUserName(userResponse.user.name);
                }
                await fetchTeacherClasses();
                const date = new Date();
                setCurrentDate(date.toLocaleDateString('hu-HU', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                }));
            } catch (err) {
                setError('Hiba történt az adatok lekérésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isBotTyping]);

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
        setIsBotTyping(true);

        try {
            const responseMessage = await sendChatMessage(userMsg);
            setChatHistory(prev => [...prev, { sender: 'bot', text: responseMessage }]);
        } catch (err) {
            setChatHistory(prev => [...prev, { sender: 'bot', text: 'Hiba történt a válasz generálása során.' }]);
        } finally {
            setIsBotTyping(false);
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
                        {isBotTyping && (
                            <div className="chat-message bot">
                                <img src={logo} alt="Logo" className="chat-logo" />
                                <div className="typing-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleChatSubmit} className="chat-input-form">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Írj egy üzenetet..."
                            className="chat-input"
                            disabled={isBotTyping}
                        />
                        <button type="submit" className="chat-submit" disabled={isBotTyping}>
                            <FaPaperPlane />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TeacherWelcome;
