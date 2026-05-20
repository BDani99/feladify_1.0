import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminLayout from './components/Admin/AdminLayout';

const AdminPrivateRoute = ({ children }) => {
    const { isAdminLoggedIn } = useAdminAuth();
    return isAdminLoggedIn ? children : <Navigate to="/admin/login" replace />;
};

const AdminApp = () => {
    return (
        <AdminAuthProvider>
            <AdminAppInner />
            <ToastContainer position="top-right" autoClose={3000} theme="dark" />
        </AdminAuthProvider>
    );
};

const AdminAppInner = () => {
    const { isAdminLoggedIn } = useAdminAuth();

    return (
        <Routes>
            <Route path="login" element={
                isAdminLoggedIn ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />
            } />
            <Route path="/*" element={
                <AdminPrivateRoute>
                    <AdminLayout />
                </AdminPrivateRoute>
            } />
            <Route index element={<Navigate to="login" replace />} />
        </Routes>
    );
};

export default AdminApp;
