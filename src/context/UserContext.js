import React, { createContext, useState, useContext, useEffect } from 'react';
import { fetchUserData } from '../api/Auth/ProfileData';

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
            try {
                const data = await fetchUserData();
                setUser(data.user);
                sessionStorage.setItem('isLoggedIn', 'true');
            } catch (error) {
                sessionStorage.removeItem('isLoggedIn');
            }
        };

        if (sessionStorage.getItem('AccessToken')) {
            fetchData();
        }
    }, []);

    const isLoggedIn = !!sessionStorage.getItem('isLoggedIn');

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <UserContext.Provider value={{ user, isLoggedIn, theme, toggleTheme }}>
            {children}
        </UserContext.Provider>
    );
};
