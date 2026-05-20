import React, { useEffect, useState, useCallback } from 'react';
import {
    getDataAssignments, deleteDataAssignment,
    getDataClasses, deleteDataClass,
    getDataAnnouncements, deleteDataAnnouncement,
} from '../../api/Admin/AdminApi';
import { toast } from 'react-toastify';

const ConfirmDeleteModal = ({ label, name, onClose, onConfirm }) => (
    <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
                <h3 className="admin-modal-title">Törlés megerősítése</h3>
                <button className="admin-modal-close" onClick={onClose}>✕</button>
            </div>
            <div className="admin-modal-body">
                <div className="admin-confirm-icon">🗑️</div>
                <p className="admin-confirm-text">Biztosan törlöd ezt a(z) {label}t?</p>
                <p className="admin-confirm-subject">{name}</p>
                <p style={{ textAlign: 'center', fontSize: '13px', color: '#f87171' }}>Ez a művelet nem visszavonható!</p>
            </div>
            <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-ghost" onClick={onClose}>Mégse</button>
                <button className="admin-btn admin-btn-danger" onClick={onConfirm}>Törlés</button>
            </div>
        </div>
    </div>
);

const AssignmentsTab = () => {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const LIMIT = 20;

    const load = useCallback(() => {
        setLoading(true);
        getDataAssignments({ page, limit: LIMIT, search })
            .then(d => { setItems(d.assignments); setTotal(d.total); })
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    }, [page, search]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async () => {
        try {
            await deleteDataAssignment(deleteTarget._id);
            toast.success('Feladat törölve!');
            setDeleteTarget(null);
            load();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <>
            <div className="admin-toolbar">
                <div className="admin-search">
                    <span className="admin-search-icon">🔍</span>
                    <input
                        type="text" placeholder="Keresés cím alapján..."
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {loading ? (
                <div className="admin-loading"><div className="admin-spinner" /></div>
            ) : items.length === 0 ? (
                <div className="admin-empty"><div className="admin-empty-icon">📝</div><p className="admin-empty-text">Nincsenek feladatok</p></div>
            ) : (
                <>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Cím</th>
                                    <th>Tantárgy</th>
                                    <th>Nehézség</th>
                                    <th>Tanár</th>
                                    <th>Beküldések</th>
                                    <th>Létrehozva</th>
                                    <th>Törlés</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(a => (
                                    <tr key={a._id}>
                                        <td style={{ fontWeight: 500, color: '#e2e8f0', maxWidth: 200 }}>{a.title}</td>
                                        <td><span className="admin-badge admin-badge-teacher">{a.subject}</span></td>
                                        <td style={{ color: '#94a3b8', fontSize: '13px' }}>{a.difficulty}</td>
                                        <td style={{ fontSize: '13px', color: '#64748b' }}>{a.teacherId?.name || '—'}</td>
                                        <td style={{ fontSize: '13px', color: '#64748b', textAlign: 'center' }}>{a.completedCount}</td>
                                        <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(a.createdAt).toLocaleDateString('hu-HU')}</td>
                                        <td>
                                            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteTarget(a)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="admin-pagination">
                        <span className="admin-pagination-info">{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} / {total}</span>
                        <div className="admin-pagination-btns">
                            <button className="admin-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                                <button key={i + 1} className={`admin-page-btn${page === i + 1 ? ' active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                            ))}
                            <button className="admin-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                        </div>
                    </div>
                </>
            )}
            {deleteTarget && <ConfirmDeleteModal label="feladat" name={deleteTarget.title} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
        </>
    );
};

const ClassesTab = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const load = () => {
        setLoading(true);
        getDataClasses()
            .then(d => setItems(d.classes))
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async () => {
        try {
            await deleteDataClass(deleteTarget._id);
            toast.success('Osztály törölve!');
            setDeleteTarget(null);
            load();
        } catch (err) {
            toast.error(err.message);
        }
    };

    return (
        <>
            {loading ? (
                <div className="admin-loading"><div className="admin-spinner" /></div>
            ) : items.length === 0 ? (
                <div className="admin-empty"><div className="admin-empty-icon">🏫</div><p className="admin-empty-text">Nincsenek osztályok</p></div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr><th>Osztálynév</th><th>Tanárok</th><th>Diákok száma</th><th>Törlés</th></tr>
                        </thead>
                        <tbody>
                            {items.map(c => (
                                <tr key={c._id}>
                                    <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.name}</td>
                                    <td style={{ fontSize: '13px', color: '#64748b' }}>
                                        {c.teacherIds?.map(t => t.name).join(', ') || '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{c.studentCount}</td>
                                    <td>
                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteTarget(c)}>🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {deleteTarget && <ConfirmDeleteModal label="osztály" name={deleteTarget.name} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
        </>
    );
};

const AnnouncementsTab = () => {
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const LIMIT = 20;

    const load = useCallback(() => {
        setLoading(true);
        getDataAnnouncements({ page, limit: LIMIT })
            .then(d => { setItems(d.announcements); setTotal(d.total); })
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    }, [page]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async () => {
        try {
            await deleteDataAnnouncement(deleteTarget._id);
            toast.success('Hirdetmény törölve!');
            setDeleteTarget(null);
            load();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <>
            {loading ? (
                <div className="admin-loading"><div className="admin-spinner" /></div>
            ) : items.length === 0 ? (
                <div className="admin-empty"><div className="admin-empty-icon">📢</div><p className="admin-empty-text">Nincsenek hirdetmények</p></div>
            ) : (
                <>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr><th>Cím</th><th>Tanár</th><th>Osztály</th><th>Határidő</th><th>Létrehozva</th><th>Törlés</th></tr>
                            </thead>
                            <tbody>
                                {items.map(a => (
                                    <tr key={a._id}>
                                        <td style={{ fontWeight: 500, color: '#e2e8f0' }}>{a.title}</td>
                                        <td style={{ fontSize: '13px', color: '#64748b' }}>{a.teacherId?.name || '—'}</td>
                                        <td style={{ fontSize: '13px', color: '#64748b' }}>{a.classId?.name || '—'}</td>
                                        <td style={{ fontSize: '12px', color: a.deadline ? '#fbbf24' : '#475569' }}>
                                            {a.deadline ? new Date(a.deadline).toLocaleDateString('hu-HU') : '—'}
                                        </td>
                                        <td style={{ color: '#64748b', fontSize: '12px' }}>{new Date(a.createdAt).toLocaleDateString('hu-HU')}</td>
                                        <td>
                                            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteTarget(a)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="admin-pagination">
                        <span className="admin-pagination-info">{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} / {total}</span>
                        <div className="admin-pagination-btns">
                            <button className="admin-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                                <button key={i + 1} className={`admin-page-btn${page === i + 1 ? ' active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                            ))}
                            <button className="admin-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                        </div>
                    </div>
                </>
            )}
            {deleteTarget && <ConfirmDeleteModal label="hirdetmény" name={deleteTarget.title} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
        </>
    );
};

const TABS = [
    { key: 'assignments', label: '📝 Feladatok' },
    { key: 'classes', label: '🏫 Osztályok' },
    { key: 'announcements', label: '📢 Hirdetmények' },
];

const AdminData = () => {
    const [activeTab, setActiveTab] = useState('assignments');

    return (
        <>
            <div className="admin-page-header">
                <h2 className="admin-page-title">Tartalmak</h2>
                <p className="admin-page-subtitle">Adatbázis tartalmak megtekintése és kezelése</p>
            </div>

            <div className="admin-tabs">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        className={`admin-tab${activeTab === t.key ? ' active' : ''}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="admin-card">
                {activeTab === 'assignments' && <AssignmentsTab />}
                {activeTab === 'classes' && <ClassesTab />}
                {activeTab === 'announcements' && <AnnouncementsTab />}
            </div>
        </>
    );
};

export default AdminData;
