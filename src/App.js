import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter } from 'react-router-dom';
import Layout from './components/Layout';
import { UserProvider } from './context/UserContext';
import { ChatProvider } from './context/ChatContext';
import './App.css';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = sessionStorage.getItem('AccessToken');
        setIsLoggedIn(!!token);
    }, []);

    const handleLoginSuccess = (token) => {
        sessionStorage.setItem('AccessToken', token);
        setIsLoggedIn(true);
    };

    return (
        <div className="App">
            <BrowserRouter>
                <UserProvider>
                    <ChatProvider>
                        <Layout isLoggedIn={isLoggedIn} onLoginSuccess={handleLoginSuccess} />
                    </ChatProvider>
                </UserProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
