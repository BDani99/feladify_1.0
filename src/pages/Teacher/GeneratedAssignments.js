import React, { useEffect, useState } from 'react';
import { fetchAssignments } from '../../api/Assignments/Teacher/Assignments';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
    FaClipboardList, 
    FaClipboard,
    FaCheckCircle, 
    FaHourglassHalf, 
    FaUsers, 
    FaBookOpen, 
    FaChartLine,
    FaArrowRight,
    FaExclamationTriangle
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/GeneratedAssignments.css';

const GeneratedAssignments = () => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await fetchAssignments();
                setAssignments(data);
            } catch (error) {
                setError('Hiba történt a dolgozatok betöltésekor');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div id="content"><LoadingSpinner /></div>;
    if (error) return <div id="content" className="error-container"><FaExclamationTriangle /> {error}</div>;

    const filteredAssignments = assignments.filter(a => {
        if (activeTab === 'all') return true;
        const total = a.studentIds?.length || 0;
        const completed = a.completedCount || 0;
        if (activeTab === 'review') return completed > 0;
        if (activeTab === 'pending') return completed === 0;
        return true;
    });

    return (
        <div id="content">
            <div className="generated-assignments-wrapper">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaClipboard /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Létrehozott Dolgozatok</h1>
                        <p className="phb-subtitle">Kövessd nyomon a diákok haladását és javítsd ki a beérkezett válaszokat</p>
                    </div>
                </div>

                <div className="stats-overview">
                    <div className="stat-card">
                        <div className="stat-icon blue"><FaClipboardList /></div>
                        <div className="stat-data">
                            <div className="stat-value">{assignments.length}</div>
                            <div className="stat-label">Összes dolgozat</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon green"><FaCheckCircle /></div>
                        <div className="stat-data">
                            <div className="stat-value">{assignments.reduce((sum, a) => sum + (a.completedCount || 0), 0)}</div>
                            <div className="stat-label">Összes kitöltés</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon orange"><FaHourglassHalf /></div>
                        <div className="stat-data">
                            <div className="stat-value">{assignments.filter(a => (a.completedCount || 0) > 0).length}</div>
                            <div className="stat-label">Javítás alatt</div>
                        </div>
                    </div>
                </div>

                <div className="filter-tabs">
                    <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>
                        Összes ({assignments.length})
                    </button>
                    <button className={activeTab === 'review' ? 'active' : ''} onClick={() => setActiveTab('review')}>
                        Javításra vár ({assignments.filter(a => (a.completedCount || 0) > 0).length})
                    </button>
                    <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>
                        Függőben ({assignments.filter(a => (a.completedCount || 0) === 0).length})
                    </button>
                </div>

                <div className="assignments-grid">
                    {filteredAssignments.length === 0 ? (
                        <div className="empty-state">
                            <FaBookOpen />
                            <p>Nincsenek dolgozatok ebben a kategóriában.</p>
                            <Link to="/dolgozat-generalas" className="create-btn">Új dolgozat létrehozása</Link>
                        </div>
                    ) : (
                        filteredAssignments.slice().reverse().map((a) => {
                            const total = a.studentIds?.length || 0;
                            const completed = a.completedCount || 0;
                            const pct = total > 0 ? (completed / total) * 100 : 0;
                            
                            return (
                                <div key={a._id} className="assignment-card-premium">
                                    <div className="card-header">
                                        <div className="subject-tag">{a.subject}</div>
                                        <div className={`difficulty-tag ${a.difficulty}`}>{a.difficulty}</div>
                                    </div>
                                    <h3 className="assignment-title">{a.title}</h3>
                                    
                                    <div className="card-details">
                                        <div className="detail-item">
                                            <FaUsers /> <span>{total} diák hozzárendelve</span>
                                        </div>
                                        <div className="detail-item">
                                            <FaChartLine /> <span>{completed} / {total} kitöltve</span>
                                        </div>
                                        <div className="detail-item">
                                            <FaHourglassHalf /> <span>{format(new Date(a.createdAt), 'yyyy.MM.dd')}</span>
                                        </div>
                                    </div>

                                    <div className="progress-container">
                                        <div className="progress-label">
                                            <span>Haladás</span>
                                            <span>{Math.round(pct)}%</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="card-actions">
                                        <Link 
                                            to={`/generalt-dolgozatok/${a._id}`} 
                                            state={{ assignment: a }}
                                            className="view-btn"
                                        >
                                            Kezelés <FaArrowRight />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeneratedAssignments;
