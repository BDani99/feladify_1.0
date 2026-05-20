import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { adminLogin } from '../../api/Admin/AdminApi';
import '../../styles/Admin.css';

const AdminLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { adminLogin: saveLogin } = useAdminAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Kérjük, töltse ki az összes mezőt.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await adminLogin(username, password);
            saveLogin(data.token, data.user);
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.message || 'Hibás bejelentkezési adatok.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-login-page">
            <div className="admin-login-card">
                <div className="admin-login-logo">
                    <div className="admin-login-logo-icon">F</div>
                    <div>
                        <h1 className="admin-login-title">Feladify Admin</h1>
                        <p className="admin-login-subtitle">Adminisztrátori bejelentkezés</p>
                    </div>
                </div>

                {error && (
                    <div className="admin-login-error">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Felhasználónév</label>
                        <input
                            className="admin-form-input"
                            type="text"
                            placeholder="feladifyadmin"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="username"
                            autoFocus
                        />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Jelszó</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="admin-form-input"
                                type={showPass ? 'text' : 'password'}
                                placeholder="••••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                style={{ paddingRight: '44px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(p => !p)}
                                style={{
                                    position: 'absolute', right: '12px', top: '50%',
                                    transform: 'translateY(-50%)', background: 'none',
                                    border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px'
                                }}
                            >
                                {showPass ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="admin-login-submit"
                        disabled={loading}
                    >
                        {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#334155' }}>
                    Feladify Admin Panel v1.0
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
