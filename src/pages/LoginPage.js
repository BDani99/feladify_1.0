import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { login } from '../api/Auth/LoginApi';
import '../styles/Login.css';
import { FaExclamationCircle, FaEye, FaEyeSlash } from 'react-icons/fa';
import logo from '../assets/logo-400.png';
import nameImg from '../assets/name.png';

const Login = ({ onLoginSuccess }) => {
    const location = useLocation();
    const [email, setEmail] = useState(location.state?.email || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const data = await login(email, password);
            localStorage.setItem('AccessToken', data.token);
            onLoginSuccess(data.token);
            window.location.reload();
        } catch (error) {
            setMessage(error.message);
        }
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleLogin}>
                <div className="login-images">
                    <img src={logo} alt="logo" className="login-logo" />
                    <img src={nameImg} alt="Feladify" className="login-name" />
                </div>
                <h2>Bejelentkezés</h2>

                <div className="form-field">
                    <label className="form-label" htmlFor="login-email">E-mail cím</label>
                    <input
                        type="email"
                        id="login-email"
                        className="login-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pelda@email.hu"
                        required
                    />
                </div>

                <div className="form-field">
                    <label className="form-label" htmlFor="login-password">Jelszó</label>
                    <div className="password-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="login-password"
                            className="login-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>

                {message && (
                    <p className="error-message">
                        <FaExclamationCircle />
                        {message}
                    </p>
                )}

                <button type="submit" className="main-button">Bejelentkezés</button>

                <p className="login-link">
                    Még nincs fiókod?{' '}
                    <a href="/regisztracio">Regisztrálj itt</a>
                </p>
            </form>
        </div>
    );
};

export default Login;
