import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../api/config';
import { FaChalkboard, FaBullhorn, FaCalendarAlt, FaClock } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import ParentChildSelector from '../../components/ParentChildSelector';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Student/StudentDashboard.css';
import '../../styles/Announcements.css';

const ParentAnnouncements = () => {
    const [children, setChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
    const [allAnnouncements, setAllAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('AccessToken');
                const [childrenRes, annRes] = await Promise.all([
                    fetch('/api/parent/children', { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/announcements`, { headers: { 'Authorization': `Bearer ${token}` } })
                ]);

                if (childrenRes.ok) {
                    const data = await childrenRes.json();
                    if (data.children && data.children.length > 0) {
                        setChildren(data.children);
                        const stored = localStorage.getItem('parent-selected-child');
                        if (!stored || !data.children.some(c => c._id === stored)) {
                            setSelectedChildId(data.children[0]._id);
                            localStorage.setItem('parent-selected-child', data.children[0]._id);
                        }
                    }
                }

                if (annRes.ok) {
                    const data = await annRes.json();
                    setAllAnnouncements(data.announcements || []);
                }
            } catch (err) {
                console.error(err);
                setError('Hiba az adatok betöltésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleChildChange = (id) => {
        setSelectedChildId(id);
        localStorage.setItem('parent-selected-child', id);
    };

    const selectedChild = children.find(c => c._id === selectedChildId);

    const announcements = selectedChild
        ? allAnnouncements.filter(ann => ann.classId?.name === selectedChild.className)
        : allAnnouncements;

    if (children.length === 0 && !loading) {
        return (
            <div id="content">
                <div className="dashboard-container">
                    <div className="dash-section-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                        <FaChalkboard style={{ fontSize: '3.5rem', color: 'var(--accent)', marginBottom: 24 }} />
                        <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Nincs még összekapcsolt gyermek</h2>
                        <p style={{ color: 'var(--color-text-dim)' }}>A faliújság megtekintéséhez adj hozzá egy gyermeket a Beállítások menüben.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="content">
          <div className="dashboard-container">
            <div className="page-header-banner">
                <div className="phb-icon"><FaChalkboard /></div>
                <div className="phb-text">
                    <h1 className="phb-title">Osztálytermi Faliújság</h1>
                    <p className="phb-subtitle">
                        {selectedChild
                            ? `${selectedChild.name} osztályának (${selectedChild.className}) legfrissebb bejelentései.`
                            : 'Nézd meg gyermeked tanárainak legfrissebb bejelentéseit.'}
                    </p>
                </div>
                {children.length > 0 && (
                    <ParentChildSelector
                        childrenList={children}
                        selectedId={selectedChildId}
                        onChange={handleChildChange}
                    />
                )}
            </div>

            {loading ? (
                <div style={{ minHeight: 300 }}><LoadingSpinner /></div>
            ) : error ? (
                <div className="alert alert-danger" role="alert">{error}</div>
            ) : (
                <div className="ann-container" style={{ padding: 0 }}>
                    <div className="ann-student-col animate-slide-in">
                        <h3 className="ann-section-title">
                            <FaBullhorn className="ann-section-title-icon" />
                            Bejövő bejelentések
                            {selectedChild && (
                                <span className="dash-count-badge" style={{ marginLeft: 'auto' }}>{announcements.length}</span>
                            )}
                        </h3>

                        {announcements.length === 0 ? (
                            <div className="ann-empty-hero">
                                <div className="ann-empty-hero-icon"><FaChalkboard /></div>
                                <h4 className="ann-empty-hero-title">Üres a faliújság</h4>
                                <p className="ann-empty-hero-subtitle">
                                    Jelenleg nincs aktív bejelentés{selectedChild ? ` a ${selectedChild.className} osztályban` : ''}.
                                </p>
                            </div>
                        ) : (
                            <div className="ann-list">
                                {announcements.map(ann => (
                                    <div key={ann._id} className="ann-student-item">
                                        <div className="ann-student-item-header">
                                            <div className="ann-teacher-info">
                                                <div className="ann-teacher-avatar">
                                                    {ann.teacherId?.name?.charAt(0) || 'T'}
                                                </div>
                                                <div>
                                                    <div className="ann-teacher-name">{ann.teacherId?.name || 'Tanár'}</div>
                                                    <div className="ann-teacher-role">osztályfőnök / tanár</div>
                                                </div>
                                            </div>
                                            <span className="ann-class-badge-green">{ann.classId?.name || 'Osztály'}</span>
                                        </div>
                                        <h4 className="ann-item-title">{ann.title}</h4>
                                        <p className="ann-item-content">{ann.content}</p>
                                        <div className="ann-item-meta ann-item-meta--bordered">
                                            <span className="ann-meta-item"><FaCalendarAlt /> {new Date(ann.createdAt).toLocaleDateString('hu-HU')}</span>
                                            <span className="ann-meta-item"><FaClock /> {new Date(ann.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>
        </div>
    );
};

export default ParentAnnouncements;
