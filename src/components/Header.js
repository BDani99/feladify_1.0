import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import logo from '../assets/logo-400.png';
import name from '../assets/name.png';
import { logoutUser } from '../api/Auth/LogoutApi';
import { fetchUserData } from '../api/Auth/ProfileData';
import { useUser } from '../context/UserContext';
import { FaSignOutAlt, FaSun, FaMoon } from 'react-icons/fa';

const Header = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useUser() || {};

    const [userName, setUserName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchUserData();
                if (response.message === 'Felhasználó adatai sikeresen lekérve') {
                    setUserName(response.user.name);
                }
            } catch (err) {}
        };

        fetchData();
    }, []);

    const handleHeaderClick = () => {
        navigate('/');
    };

    const handleLogout = async () => {
        try {
            const response = await logoutUser();
            window.location.reload();
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    };

    return (
        <header>
            <div className='Header-container'>
                <div className='header-images' onClick={handleHeaderClick}>
                    <img src={logo} alt='logo' className='logo' />
                    <img src={name} alt='logo' className='name' />
                </div>
                <div className='header-right'>
                    {userName && <span className='header-username'>{userName}</span>}
                    <button className='theme-toggle-button' onClick={toggleTheme} aria-label="Téma váltás">
                        {theme === 'dark' ? <FaSun /> : <FaMoon />}
                    </button>
                    <button className='logout-button' onClick={handleLogout}>
                        <FaSignOutAlt />
                        <span>Kijelentkezés</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
