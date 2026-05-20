import { API_BASE_URL } from '../config';

const getAdminToken = () => localStorage.getItem('AdminToken');

const adminFetch = async (url, options = {}) => {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE_URL}/admin${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Szerverhiba');
    return data;
};

export const adminLogin = (username, password) =>
    adminFetch('/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const getUsers = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return adminFetch(`/users?${qs}`);
};

export const createUser = (data) =>
    adminFetch('/users', { method: 'POST', body: JSON.stringify(data) });

export const updateUser = (id, data) =>
    adminFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteUser = (id) =>
    adminFetch(`/users/${id}`, { method: 'DELETE' });

export const getCostStats = () => adminFetch('/cost-stats');

export const getOverviewStats = () => adminFetch('/stats/overview');

export const getActivityStats = () => adminFetch('/stats/activity');

export const getAssignmentStats = () => adminFetch('/stats/assignments');

export const getSystemInfo = () => adminFetch('/system');

export const getDataAssignments = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return adminFetch(`/data/assignments?${qs}`);
};

export const deleteDataAssignment = (id) =>
    adminFetch(`/data/assignments/${id}`, { method: 'DELETE' });

export const getDataClasses = () => adminFetch('/data/classes');

export const deleteDataClass = (id) =>
    adminFetch(`/data/classes/${id}`, { method: 'DELETE' });

export const getDataAnnouncements = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return adminFetch(`/data/announcements?${qs}`);
};

export const deleteDataAnnouncement = (id) =>
    adminFetch(`/data/announcements/${id}`, { method: 'DELETE' });
