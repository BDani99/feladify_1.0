import React, { useEffect, useState, useCallback } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/Admin/AdminApi';
import { toast } from 'react-toastify';

const ROLES = ['teacher', 'student', 'parent'];
const ROLE_LABELS = { teacher: 'Tanár', student: 'Diák', parent: 'Szülő', admin: 'Admin' };
const ROLE_BADGE = { teacher: 'admin-badge-teacher', student: 'admin-badge-student', parent: 'admin-badge-parent', admin: 'admin-badge-admin' };
const SUBJECTS = ['Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Matematika', 'Környezetismeret', 'Történelem', 'Fizika', 'Biológia', 'Földrajz'];

const EMPTY_FORM = { name: '', email: '', password: '', role: 'student', subjects: [], className: '' };

const UserModal = ({ user, onClose, onSave }) => {
    const isEdit = !!user?._id;
    const [form, setForm] = useState(isEdit ? { ...user, password: '' } : EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleSubject = (s) => {
        set('subjects', form.subjects.includes(s)
            ? form.subjects.filter(x => x !== s)
            : [...form.subjects, s]);
    };

    const handleSave = async () => {
        if (!form.name || !form.email || (!isEdit && !form.password)) {
            toast.error('Töltsd ki a kötelező mezőket!');
            return;
        }
        setSaving(true);
        try {
            const payload = { ...form };
            if (isEdit && !payload.password) delete payload.password;
            await onSave(payload);
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-modal-overlay" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <div className="admin-modal-header">
                    <h3 className="admin-modal-title">{isEdit ? 'Felhasználó szerkesztése' : 'Új felhasználó'}</h3>
                    <button className="admin-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="admin-modal-body">
                    <div className="admin-form-row">
                        <div className="admin-form-group">
                            <label className="admin-form-label">Név *</label>
                            <input className="admin-form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Teljes név" />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Email *</label>
                            <input className="admin-form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
                        </div>
                    </div>
                    <div className="admin-form-row">
                        <div className="admin-form-group">
                            <label className="admin-form-label">Jelszó {isEdit ? '(üresen hagyva nem változik)' : '*'}</label>
                            <input className="admin-form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Szerepkör *</label>
                            <select className="admin-form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                        </div>
                    </div>

                    {form.role === 'student' && (
                        <div className="admin-form-group">
                            <label className="admin-form-label">Osztály</label>
                            <input className="admin-form-input" value={form.className || ''} onChange={e => set('className', e.target.value)} placeholder="pl. 7. A" />
                        </div>
                    )}

                    {form.role === 'teacher' && (
                        <div className="admin-form-group">
                            <label className="admin-form-label">Tantárgyak</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                {SUBJECTS.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => toggleSubject(s)}
                                        style={{
                                            padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
                                            cursor: 'pointer', border: '1px solid',
                                            background: form.subjects.includes(s) ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
                                            borderColor: form.subjects.includes(s) ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                            color: form.subjects.includes(s) ? '#60a5fa' : '#94a3b8',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="admin-modal-footer">
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Mégse</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Mentés...' : (isEdit ? 'Módosítás' : 'Létrehozás')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeleteModal = ({ user, onClose, onConfirm }) => (
    <div className="admin-modal-overlay" onClick={onClose}>
        <div className="admin-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
                <h3 className="admin-modal-title">Törlés megerősítése</h3>
                <button className="admin-modal-close" onClick={onClose}>✕</button>
            </div>
            <div className="admin-modal-body">
                <div className="admin-confirm-icon">🗑️</div>
                <p className="admin-confirm-text">Biztosan törlöd ezt a felhasználót?</p>
                <p className="admin-confirm-subject">{user.name} ({user.email})</p>
                <p style={{ textAlign: 'center', fontSize: '13px', color: '#f87171' }}>Ez a művelet nem visszavonható!</p>
            </div>
            <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-ghost" onClick={onClose}>Mégse</button>
                <button className="admin-btn admin-btn-danger" onClick={onConfirm}>Törlés</button>
            </div>
        </div>
    </div>
);

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [editUser, setEditUser] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const LIMIT = 20;

    const load = useCallback(() => {
        setLoading(true);
        getUsers({ page, limit: LIMIT, search, role: roleFilter })
            .then(data => { setUsers(data.users); setTotal(data.total); })
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    }, [page, search, roleFilter]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async (data) => {
        await createUser(data);
        toast.success('Felhasználó létrehozva!');
        load();
    };

    const handleEdit = async (data) => {
        await updateUser(editUser._id, data);
        toast.success('Felhasználó módosítva!');
        load();
    };

    const handleDelete = async () => {
        try {
            await deleteUser(deleteTarget._id);
            toast.success('Felhasználó törölve!');
            setDeleteTarget(null);
            load();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <>
            <div className="admin-page-header">
                <h2 className="admin-page-title">Felhasználók</h2>
                <p className="admin-page-subtitle">Összes regisztrált felhasználó kezelése</p>
            </div>

            <div className="admin-card">
                <div className="admin-toolbar">
                    <div className="admin-search">
                        <span className="admin-search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Keresés név vagy email alapján..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <select
                        className="admin-filter-select"
                        value={roleFilter}
                        onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">Összes szerep</option>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button className="admin-btn admin-btn-primary" onClick={() => setShowCreate(true)}>
                        ＋ Új felhasználó
                    </button>
                </div>

                {loading ? (
                    <div className="admin-loading"><div className="admin-spinner" /></div>
                ) : users.length === 0 ? (
                    <div className="admin-empty">
                        <div className="admin-empty-icon">👥</div>
                        <p className="admin-empty-text">Nem találhatók felhasználók</p>
                    </div>
                ) : (
                    <>
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Név</th>
                                        <th>Email</th>
                                        <th>Szerepkör</th>
                                        <th>Részletek</th>
                                        <th>Regisztráció</th>
                                        <th>Műveletek</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id}>
                                            <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{u.name}</td>
                                            <td style={{ color: '#64748b', fontSize: '13px' }}>{u.email}</td>
                                            <td>
                                                <span className={`admin-badge ${ROLE_BADGE[u.role] || ''}`}>
                                                    {ROLE_LABELS[u.role] || u.role}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '12px', color: '#64748b' }}>
                                                {u.role === 'teacher' && u.subjects?.length > 0 && (
                                                    <span>{u.subjects.slice(0, 2).join(', ')}{u.subjects.length > 2 ? ' +' + (u.subjects.length - 2) : ''}</span>
                                                )}
                                                {u.role === 'student' && u.className && <span>{u.className}</span>}
                                            </td>
                                            <td style={{ color: '#64748b', fontSize: '12px' }}>
                                                {new Date(u.createdAt).toLocaleDateString('hu-HU')}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                                        onClick={() => setEditUser(u)}
                                                        title="Szerkesztés"
                                                    >
                                                        ✏️
                                                    </button>
                                                    {u.role !== 'admin' && (
                                                        <button
                                                            className="admin-btn admin-btn-danger admin-btn-sm"
                                                            onClick={() => setDeleteTarget(u)}
                                                            title="Törlés"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="admin-pagination">
                            <span className="admin-pagination-info">
                                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} / {total} felhasználó
                            </span>
                            <div className="admin-pagination-btns">
                                <button className="admin-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const p = i + 1;
                                    return <button key={p} className={`admin-page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
                                })}
                                <button className="admin-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showCreate && <UserModal onClose={() => setShowCreate(false)} onSave={handleCreate} />}
            {editUser && <UserModal user={editUser} onClose={() => setEditUser(null)} onSave={handleEdit} />}
            {deleteTarget && <DeleteModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
        </>
    );
};

export default AdminUsers;
