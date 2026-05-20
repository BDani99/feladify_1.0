import React, { createContext, useState, useContext } from 'react';

const AdminAuthContext = createContext();

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminAuthProvider = ({ children }) => {
    const [adminUser, setAdminUser] = useState(() => {
        try {
            const stored = localStorage.getItem('AdminUser');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const adminLogin = (token, user) => {
        localStorage.setItem('AdminToken', token);
        localStorage.setItem('AdminUser', JSON.stringify(user));
        setAdminUser(user);
    };

    const adminLogout = () => {
        localStorage.removeItem('AdminToken');
        localStorage.removeItem('AdminUser');
        setAdminUser(null);
    };

    const isAdminLoggedIn = !!localStorage.getItem('AdminToken') && !!adminUser;

    return (
        <AdminAuthContext.Provider value={{ adminUser, adminLogin, adminLogout, isAdminLoggedIn }}>
            {children}
        </AdminAuthContext.Provider>
    );
};
