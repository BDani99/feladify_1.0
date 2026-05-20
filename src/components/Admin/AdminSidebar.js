import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

const navItems = [
    { path: '/admin/dashboard', icon: '📊', label: 'Áttekintés' },
    { path: '/admin/users', icon: '👥', label: 'Felhasználók' },
    { path: '/admin/data', icon: '🗄️', label: 'Tartalmak' },
    { path: '/admin/costs', icon: '💰', label: 'AI Költségek' },
    { path: '/admin/statistics', icon: '📈', label: 'Statisztikák' },
    { path: '/admin/system', icon: '⚙️', label: 'Rendszer' },
];

const AdminSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { adminLogout, adminUser } = useAdminAuth();

    const handleLogout = () => {
        adminLogout();
        navigate('/admin/login');
    };

    return (
        <aside className="admin-sidebar">
            <div className="admin-sidebar-logo">
                <div className="logo-icon">F</div>
                <div className="logo-text">
                    <span className="logo-title">Feladify</span>
                    <span className="logo-sub">Admin Panel</span>
                </div>
            </div>

            <nav className="admin-nav">
                <span className="admin-nav-section">Navigáció</span>
                {navItems.map(item => (
                    <button
                        key={item.path}
                        className={`admin-nav-item${location.pathname === item.path ? ' active' : ''}`}
                        onClick={() => navigate(item.path)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="admin-sidebar-footer">
                <div style={{ padding: '0 14px 12px', fontSize: '12px', color: '#475569' }}>
                    Bejelentkezve: <span style={{ color: '#60a5fa' }}>{adminUser?.name}</span>
                </div>
                <button className="admin-logout-btn" onClick={handleLogout}>
                    <span className="nav-icon">🚪</span>
                    Kijelentkezés
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
