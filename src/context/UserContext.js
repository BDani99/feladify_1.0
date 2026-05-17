import React, { createContext, useState, useContext, useEffect } from 'react';
import { fetchUserData } from '../api/Auth/ProfileData';
import { isTokenExpired } from '../utils/tokenUtils';
import { handleSessionExpiry } from '../utils/apiErrorHandler';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('feladify-theme') || 'dark');

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('feladify-theme', theme);
    }, [theme]);

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('AccessToken');

            if (!token || isTokenExpired(token)) {
                handleSessionExpiry();
                return;
            }

            try {
                const data = await fetchUserData();
                setUser(data.user);
                localStorage.setItem('isLoggedIn', 'true');
            } catch (error) {
                if (error.message !== 'SESSION_EXPIRED' && error.message !== 'UNAUTHORIZED') {
                    localStorage.removeItem('isLoggedIn');
                }
            }
        };

        if (localStorage.getItem('AccessToken')) {
            fetchData();
        }
    }, []);

    const isLoggedIn = !!localStorage.getItem('isLoggedIn');

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <UserContext.Provider value={{ user, isLoggedIn, theme, toggleTheme }}>
            {children}
        </UserContext.Provider>
    );
};
