import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminDashboard from '../../pages/Admin/AdminDashboard';
import AdminUsers from '../../pages/Admin/AdminUsers';
import AdminData from '../../pages/Admin/AdminData';
import AdminCosts from '../../pages/Admin/AdminCosts';
import AdminStatistics from '../../pages/Admin/AdminStatistics';
import AdminSystem from '../../pages/Admin/AdminSystem';
import '../../styles/Admin.css';

const pageTitles = {
    '/admin/dashboard': 'Áttekintés',
    '/admin/users': 'Felhasználók',
    '/admin/data': 'Tartalmak',
    '/admin/costs': 'AI Költségek',
    '/admin/statistics': 'Statisztikák',
    '/admin/system': 'Rendszer',
};

const AdminLayout = () => {
    const location = useLocation();
    const title = pageTitles[location.pathname] || 'Admin';

    return (
        <div className="admin-root">
            <AdminSidebar />
            <div style={{ flex: 1 }}>
                <header className="admin-header">
                    <h1 className="admin-header-title">{title}</h1>
                    <div className="admin-header-right">
                        <div className="admin-header-user">
                            🛡️ Admin
                        </div>
                    </div>
                </header>
                <main className="admin-content">
                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="data" element={<AdminData />} />
                        <Route path="costs" element={<AdminCosts />} />
                        <Route path="statistics" element={<AdminStatistics />} />
                        <Route path="system" element={<AdminSystem />} />
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
