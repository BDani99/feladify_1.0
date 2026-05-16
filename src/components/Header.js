import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import logo from '../assets/logo-400.png';
import name from '../assets/name.png';
import { logoutUser } from '../api/Auth/LogoutApi';
import { fetchUserData } from '../api/Auth/ProfileData';
import { useUser } from '../context/UserContext';
import { FaMoon, FaSun, FaSignOutAlt } from 'react-icons/fa';
import NotificationBell from './NotificationBell';

const Header = () => {
    const navigate = useNavigate();
    const { user, theme, toggleTheme } = useUser() || {};

    const [userName, setUserName] = useState('');

    useEffect(() => {
        fetchUserData()
            .then(res => { if (res?.user?.name) setUserName(res.user.name); })
            .catch(() => {});
    }, []);

    const handleLogout = async () => {
        try {
            await logoutUser();
            window.location.reload();
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    };

    const initial = userName ? userName.charAt(0).toUpperCase() : '?';

    return (
        <header>
            <div className="Header-container">
                <div className="header-images" onClick={() => navigate('/')}>
                    <img src={logo} alt="logo" className="logo" />
                    <img src={name} alt="feladify" className="name" />
                </div>

                <div className="header-right">
                    {/* Téma váltó */}
                    <button className="header-icon-btn" onClick={toggleTheme} aria-label="Téma váltás">
                        {theme === 'dark' ? <FaSun /> : <FaMoon />}
                    </button>

                    {/* Értesítések */}
                    <NotificationBell />

                    {/* Felhasználó (egyelőre inaktív) */}
                    <div 
                        className="header-user-btn interactive" 
                        onClick={() => {
                            const path = user?.role === 'teacher' ? '/tanar-beallitasok' : '/diak-beallitasok';
                            navigate(path, { state: { activeTab: 'account' } });
                        }}
                    >
                        <span className="user-avatar">{initial}</span>
                        {userName && <span className="user-name">{userName}</span>}
                    </div>

                    {/* Kijelentkezés */}
                    <button className="header-logout-btn" onClick={handleLogout}>
                        <FaSignOutAlt />
                        <span>Kijelentkezés</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
