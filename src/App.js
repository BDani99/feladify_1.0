import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import { UserProvider } from './context/UserContext';
import { ChatProvider } from './context/ChatContext';
import { TeacherChatProvider } from './context/TeacherChatContext';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('AccessToken');
        setIsLoggedIn(!!token);
    }, []);

    const handleLoginSuccess = (token) => {
        localStorage.setItem('AccessToken', token);
        setIsLoggedIn(true);
    };

    return (
        <div className="App">
            <ErrorBoundary>
                <BrowserRouter>
                    <UserProvider>
                        <ChatProvider>
                            <TeacherChatProvider>
                                <Layout isLoggedIn={isLoggedIn} onLoginSuccess={handleLoginSuccess} />
                                <ToastContainer />
                            </TeacherChatProvider>
                        </ChatProvider>
                    </UserProvider>
                </BrowserRouter>
            </ErrorBoundary>
        </div>
    );
}

export default App;
