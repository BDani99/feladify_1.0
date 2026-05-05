import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import logo from '../assets/logo-400.png';
import name from '../assets/name.png';
import { logoutUser } from '../api/Auth/LogoutApi';
import { fetchUserData } from '../api/Auth/ProfileData';

const Header = () => {
    const navigate = useNavigate();

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [userName, setUserName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchUserData();

                if (response.message === 'Felhasználó adatai sikeresen lekérve') {
                    setUserName(response.user.name);
                    setMessage('Sikeresen betöltve az adatok!');
                } else {
                    setMessage('Nem található felhasználói adat.');
                }
            } catch (err) {
                setError('Hiba történt az adatok lekérésekor.');
            }
        };

        fetchData();
    }, []);

    const handleHeaderClick = () => {
        navigate('/');
    };

    const handleLogout = async () => {
        try {
            const response = await logoutUser();
            console.log(response.message);
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
                    {/*<h2 className='header-name'>FELADIFY</h2>*/}
                </div>
                {/*<div className='user-name'>{userName || ''}</div>*/}
                <button className='logout-button' onClick={handleLogout}>
                    Kijelentkezés
                </button>
            </div>
        </header>
    );
};

export default Header;
