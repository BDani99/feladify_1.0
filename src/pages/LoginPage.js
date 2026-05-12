import React, { useState } from 'react';
import { login } from '../api/Auth/LoginApi';
import '../styles/Login.css';
import logo from '../assets/logo-400.png';
import name from '../assets/name.png';

const Login = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const data = await login(email, password);
            sessionStorage.setItem('AccessToken', data.token);
            onLoginSuccess(data.token);
            window.location.reload();
        } catch (error) {
            setMessage(error.message);
            console.error(error.message);
        }
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleLogin}>
                <div className='login-images'>
                    <img src={logo} alt='logo' className='login-logo' />
                    <img src={name} alt='logo' className='login-name-png' />
                </div>
                <h2>Bejelentkezés</h2>
                <div>
                    <label className='login-label' htmlFor="email">E-mail</label>
                    <input
                        type="email"
                        id="email"
                        className='login-input'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className='login-label' htmlFor="password">Jelszó</label>
                    <input
                        type="password"
                        id="password"
                        className='login-input'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="main-button">Bejelentkezés</button>
                {message && <p className='error-message'>{message}</p>}
                <p className='login-link'>
                    Még nincs fiókod?{' '}
                    <a href="/regisztracio">Regisztrálj itt</a>
                </p>
            </form>
        </div>
    );
};

export default Login;
