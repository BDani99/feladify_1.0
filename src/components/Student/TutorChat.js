import React, { useState, useRef, useEffect } from 'react';
import { sendTutorMessage } from '../../api/Student/TutorChat';
import '../../styles/Student/TutorChat.css';

const TutorChat = ({ questionText, correctAnswer, studentAnswer }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg = { role: 'user', content: text };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setLoading(true);

        try {
            const data = await sendTutorMessage(questionText, correctAnswer, studentAnswer, newHistory);
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Hiba történt. Próbáld újra.' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="tutor-chat-container">
            <div className="tutor-chat-messages">
                {messages.length === 0 && (
                    <span className="tutor-msg-loading">Kérdezd meg a tanárt – rávezető kérdésekkel segít!</span>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`tutor-msg ${msg.role}`}>
                        {msg.content}
                    </div>
                ))}
                {loading && <span className="tutor-msg-loading">A tanár gondolkodik...</span>}
                <div ref={messagesEndRef} />
            </div>
            <div className="tutor-chat-input-row">
                <input
                    type="text"
                    placeholder="Írj üzenetet..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                />
                <button
                    className="tutor-chat-send"
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                >
                    Küldés
                </button>
            </div>
        </div>
    );
};

export default TutorChat;
