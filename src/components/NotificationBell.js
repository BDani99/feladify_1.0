import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaBell, FaCheck, FaClipboardList, FaTrophy, FaTrash } from 'react-icons/fa';
import { API_BASE_URL } from '../api/config';
import '../styles/NotificationBell.css';

const TYPE_CONFIG = {
  new_assignment:      { icon: <FaClipboardList />, color: '#3b82f6', label: 'Dolgozat' },
  assignment_submitted:{ icon: <FaCheck />,         color: '#10b981', label: 'Beküldés' },
  assignment_graded:   { icon: <FaTrophy />,        color: '#f59e0b', label: 'Értékelés' },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'Most';
  if (diff < 3600) return `${Math.floor(diff / 60)} perce`;
  if (diff < 86400)return `${Math.floor(diff / 3600)} órája`;
  return `${Math.floor(diff / 86400)} napja`;
}

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    const token = sessionStorage.getItem('AccessToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Kattintás kívülre → zárás
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(prev => !prev);
  };

  const markAllRead = async () => {
    const token = sessionStorage.getItem('AccessToken');
    try {
      await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const markRead = async (id) => {
    const token = sessionStorage.getItem('AccessToken');
    try {
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const deleteOne = async (id, e) => {
    e.stopPropagation();
    const token = sessionStorage.getItem('AccessToken');
    try {
      await fetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => {
        const n = prev.find(n => n._id === id);
        if (n && !n.read) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n._id !== id);
      });
    } catch {}
  };

  const deleteAll = async () => {
    const token = sessionStorage.getItem('AccessToken');
    try {
      await fetch(`${API_BASE_URL}/notifications/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className="notif-wrapper" ref={ref}>
      <button
        className="header-icon-btn notif-btn"
        onClick={handleOpen}
        aria-label="Értesítések"
      >
        <FaBell />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Értesítések</span>
            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button className="notif-mark-all" onClick={markAllRead}>
                  Összes olvasva
                </button>
              )}
              {notifications.length > 0 && (
                <button className="notif-delete-all" onClick={deleteAll} title="Összes törlése">
                  <FaTrash />
                </button>
              )}
            </div>
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <FaBell className="notif-empty-icon" />
                <p>Nincs értesítés</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.new_assignment;
                return (
                  <div
                    key={n._id}
                    className={`notif-item ${n.read ? 'read' : 'unread'}`}
                    onClick={() => !n.read && markRead(n._id)}
                  >
                    <div className="notif-icon" style={{ color: cfg.color, background: `${cfg.color}18` }}>
                      {cfg.icon}
                    </div>
                    <div className="notif-body">
                      <p className="notif-item-title">{n.title}</p>
                      <p className="notif-item-msg">{n.message}</p>
                      <span className="notif-time">{timeAgo(n.createdAt)}</span>
                    </div>
                    {!n.read && <div className="notif-dot" />}
                    <button
                      className="notif-delete-btn"
                      onClick={(e) => deleteOne(n._id, e)}
                      title="Törlés"
                    >
                      <FaTrash />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
