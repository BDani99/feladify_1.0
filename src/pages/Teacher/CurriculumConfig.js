import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../context/UserContext';
import { API_BASE_URL } from '../../api/config';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmModal from '../../components/ConfirmModal';
import {
    FaBook, FaSave, FaUndo, FaPlus, FaTrash,
    FaChevronDown, FaChevronUp, FaExclamationCircle,
    FaCheckCircle, FaEdit, FaGripVertical,
    FaArrowLeft, FaArrowRight
} from 'react-icons/fa';
import '../../styles/Teacher/CurriculumConfig.css';

const CurriculumConfig = () => {
    const { user } = useUser() || {};
    const subjects = useMemo(() => {
        const raw = user?.subjects || [];
        const hasIrodalom = raw.some(s => s.toLowerCase() === 'irodalom');
        const hasNyelvtan = raw.some(s => s.toLowerCase() === 'nyelvtan');
        if (hasIrodalom && hasNyelvtan) {
            const filtered = raw.filter(s => s.toLowerCase() !== 'nyelvtan');
            const irodalomIndex = filtered.findIndex(s => s.toLowerCase() === 'irodalom');
            const nyelvtanItem = raw.find(s => s.toLowerCase() === 'nyelvtan');
            filtered.splice(irodalomIndex + 1, 0, nyelvtanItem);
            return filtered;
        }
        return raw;
    }, [user?.subjects]);

    const [activeSubject, setActiveSubject] = useState('');
    const [activeGrade, setActiveGrade] = useState('');
    
    // Hold data for all grades of the active subject
    const [subjectData, setSubjectData] = useState({
        '5': [],
        '6': [],
        '7': [],
        '8': []
    });
    
    // Track which grades have unsaved changes
    const [modifiedGrades, setModifiedGrades] = useState(new Set());

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [expandedTopicId, setExpandedTopicId] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    
    // Drag and Drop state
    const [draggedIndex, setDraggedIndex] = useState(null);

    const [teacherGrades, setTeacherGrades] = useState([]);

    // Fetch teacher's assigned classes on mount to determine which grades they teach
    useEffect(() => {
        const fetchTeacherClasses = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/teacher/classes`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    const classes = data.classes || [];
                    const grades = new Set();
                    classes.forEach(c => {
                        if (c.name) {
                            const match = c.name.match(/^(\d+)/);
                            if (match) {
                                grades.add(match[1]);
                            }
                        }
                    });
                    setTeacherGrades(Array.from(grades));
                }
            } catch (err) {
                console.error('Hiba a tanár osztályainak lekérdezésekor:', err);
            }
        };
        fetchTeacherClasses();
    }, []);

    // Get available individual grades dynamically based on subject and teacher's classes
    const getAvailableGrades = (subject) => {
        if (!subject) return [];
        const norm = subject.trim().toLowerCase();
        let defaultGrades = ['5', '6', '7', '8'];
        if (['matematika', 'nyelvtan', 'irodalom', 'történelem', 'tortenelem', 'angol', 'német', 'nemet'].includes(norm)) {
            defaultGrades = ['5', '6', '7', '8'];
        } else if (['környezetismeret', 'kornyezet', 'természetismeret', 'természettudomány'].includes(norm)) {
            defaultGrades = ['5', '6'];
        } else if (['fizika', 'biológia', 'biologia', 'földrajz', 'foldrajz'].includes(norm)) {
            defaultGrades = ['7', '8'];
        }

        if (teacherGrades && teacherGrades.length > 0) {
            const filtered = defaultGrades.filter(g => teacherGrades.includes(g));
            return filtered.length > 0 ? filtered : defaultGrades;
        }
        return defaultGrades;
    };

    // Set initial subject and grade
    useEffect(() => {
        if (subjects.length > 0) {
            const initialSubj = activeSubject || subjects[0];
            if (!activeSubject) {
                setActiveSubject(initialSubj);
            }
            const grades = getAvailableGrades(initialSubj);
            if (grades.length > 0 && (!activeGrade || !grades.includes(activeGrade))) {
                setActiveGrade(grades[0]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, teacherGrades]);

    // Fetch details for all grades of the subject when subject or teacherGrades changes
    useEffect(() => {
        if (activeSubject) {
            fetchDetailsForAllGrades(activeSubject);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSubject, teacherGrades]);

    const fetchDetailsForAllGrades = async (subj) => {
        setLoading(true);
        setError('');
        setModifiedGrades(new Set());
        setExpandedTopicId(null);
        setSubjectData({ '5': [], '6': [], '7': [], '8': [] });
        
        const grades = getAvailableGrades(subj);
        const newData = { '5': [], '6': [], '7': [], '8': [] };
        
        try {
            const fetchPromises = grades.map(async (grade) => {
                const response = await fetch(`${API_BASE_URL}/curriculum/detail?subject=${encodeURIComponent(subj)}&grade=${grade}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
                    }
                });
                const data = await response.json();
                if (response.ok) {
                    newData[grade] = data.topics || [];
                } else {
                    throw new Error(data.message || `Hiba a(z) ${grade}. osztály betöltésekor.`);
                }
            });
            
            await Promise.all(fetchPromises);
            setSubjectData(newData);
        } catch (err) {
            setError(err.message || 'Hálózati hiba a kerettanterv betöltésekor.');
        } finally {
            setLoading(false);
        }
    };

    const handleTopicFieldChange = (index, field, value) => {
        const updated = [...(subjectData[activeGrade] || [])];
        updated[index] = { ...updated[index], [field]: value };
        
        setSubjectData(prev => ({
            ...prev,
            [activeGrade]: updated
        }));
        
        const nextModified = new Set(modifiedGrades);
        nextModified.add(activeGrade);
        setModifiedGrades(nextModified);
    };

    const handleDeleteTopic = (index) => {
        const updated = (subjectData[activeGrade] || []).filter((_, idx) => idx !== index);
        
        setSubjectData(prev => ({
            ...prev,
            [activeGrade]: updated
        }));
        
        const nextModified = new Set(modifiedGrades);
        nextModified.add(activeGrade);
        setModifiedGrades(nextModified);
    };

    const handleAddTopic = () => {
        const newTopic = {
            id: `custom_topic_${Date.now()}`,
            name: 'Új témakör',
            recommendedHours: 10,
            learningOutcomes: '',
            developmentalTasks: '',
            concepts: '',
            suggestedActivities: ''
        };
        
        const updated = [...(subjectData[activeGrade] || []), newTopic];
        
        setSubjectData(prev => ({
            ...prev,
            [activeGrade]: updated
        }));
        
        const nextModified = new Set(modifiedGrades);
        nextModified.add(activeGrade);
        setModifiedGrades(nextModified);
        
        setExpandedTopicId(newTopic.id);
    };

    // Reassign a topic from one grade to another (e.g. promote or demote)
    const handleMoveGrade = (index, fromGrade, toGrade) => {
        const fromTopics = [...(subjectData[fromGrade] || [])];
        const toTopics = [...(subjectData[toGrade] || [])];
        
        const [movedTopic] = fromTopics.splice(index, 1);
        toTopics.push(movedTopic);
        
        setSubjectData(prev => ({
            ...prev,
            [fromGrade]: fromTopics,
            [toGrade]: toTopics
        }));
        
        const nextModified = new Set(modifiedGrades);
        nextModified.add(fromGrade);
        nextModified.add(toGrade);
        setModifiedGrades(nextModified);
        
        setSuccessMessage(`"${movedTopic.name}" áthelyezve a(z) ${toGrade}. osztályba.`);
        setTimeout(() => setSuccessMessage(''), 3500);
    };

    // Save changes for all modified grades
    const handleSave = async () => {
        const gradesToSave = Array.from(modifiedGrades);
        if (gradesToSave.length === 0) {
            setSuccessMessage('Nincs mentendő változtatás.');
            setTimeout(() => setSuccessMessage(''), 2000);
            return;
        }

        setSaving(true);
        setError('');
        setSuccessMessage('');
        
        try {
            const savePromises = gradesToSave.map(async (grade) => {
                const response = await fetch(`${API_BASE_URL}/curriculum`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                    },
                    body: JSON.stringify({
                        subject: activeSubject,
                        grade,
                        topics: subjectData[grade]
                    })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `Hiba a(z) ${grade}. osztály mentésekor.`);
                }
            });

            await Promise.all(savePromises);
            setSuccessMessage('Minden változtatás sikeresen elmentve!');
            setModifiedGrades(new Set());
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message || 'Hálózati hiba a mentés során.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetConfirm = async () => {
        setIsConfirmOpen(false);
        setLoading(true);
        setError('');
        setSuccessMessage('');
        try {
            const response = await fetch(`${API_BASE_URL}/curriculum`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
                },
                body: JSON.stringify({
                    subject: activeSubject,
                    grade: activeGrade
                })
            });
            const data = await response.json();
            if (response.ok) {
                setSuccessMessage(`A(z) ${activeGrade}. osztály tanterve sikeresen visszaállítva!`);
                
                // Fetch single reset grade detail and merge back
                const resDetail = await fetch(`${API_BASE_URL}/curriculum/detail?subject=${encodeURIComponent(activeSubject)}&grade=${activeGrade}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
                    }
                });
                const detailData = await resDetail.json();
                if (resDetail.ok) {
                    setSubjectData(prev => ({
                        ...prev,
                        [activeGrade]: detailData.topics || []
                    }));
                    
                    const nextModified = new Set(modifiedGrades);
                    nextModified.delete(activeGrade);
                    setModifiedGrades(nextModified);
                }
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(data.message || 'Hiba a visszaállítás során.');
            }
        } catch (err) {
            setError('Hálózati hiba a visszaállítás során.');
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id) => {
        setExpandedTopicId(expandedTopicId === id ? null : id);
    };

    const handleSubjectChange = (subj) => {
        setActiveSubject(subj);
        const grades = getAvailableGrades(subj);
        if (grades.length > 0 && !grades.includes(activeGrade)) {
            setActiveGrade(grades[0]);
        }
    };

    // Native Drag and Drop logic
    const handleDragStart = (e, index) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            e.preventDefault();
            return;
        }
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const updated = [...(subjectData[activeGrade] || [])];
        const draggedItem = updated[draggedIndex];
        updated.splice(draggedIndex, 1);
        updated.splice(index, 0, draggedItem);

        setDraggedIndex(index);
        setSubjectData(prev => ({
            ...prev,
            [activeGrade]: updated
        }));
        
        const nextModified = new Set(modifiedGrades);
        nextModified.add(activeGrade);
        setModifiedGrades(nextModified);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    // Determine prev and next grades for the active subject
    const availableGrades = getAvailableGrades(activeSubject);
    const activeGradeIdx = availableGrades.indexOf(activeGrade);
    const prevGrade = activeGradeIdx > 0 ? availableGrades[activeGradeIdx - 1] : null;
    const nextGrade = activeGradeIdx < availableGrades.length - 1 ? availableGrades[activeGradeIdx + 1] : null;

    const currentTopics = subjectData[activeGrade] || [];

    return (
        <div id="content">
            <div className="curriculum-config-container animate-fade-in">
                {/* Header Banner */}
                <div className="page-header-banner">
                    <div className="phb-icon"><FaBook /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Kerettanterv testreszabása</h1>
                        <p className="phb-subtitle">Módosítsd az ajánlott témaköröket évfolyamonként a dolgozat generáláshoz</p>
                    </div>
                </div>

                {subjects.length === 0 ? (
                    <div className="error-state glass-card">
                        <FaExclamationCircle className="error-icon" />
                        <p>Nem vagy egyetlen tantárgyhoz sem hozzárendelve. Vedd fel a kapcsolatot a rendszergazdával.</p>
                    </div>
                ) : (
                    <>
                        {/* Subject Tabs */}
                        <div className="subject-tabs-container">
                            {subjects.map((subj) => (
                                <button
                                    key={subj}
                                    className={`subject-tab ${activeSubject === subj ? 'active' : ''}`}
                                    onClick={() => handleSubjectChange(subj)}
                                >
                                    {subj}
                                </button>
                            ))}
                        </div>

                        {/* Grade & Actions Panel */}
                        <div className="control-panel glass-card">
                            <div className="grade-range-selector">
                                <span className="label-text">Évfolyam:</span>
                                <div className="range-chips">
                                    {availableGrades.map((grade) => {
                                        const isTabModified = modifiedGrades.has(grade);
                                        return (
                                            <button
                                                key={grade}
                                                className={`range-chip ${activeGrade === grade ? 'active' : ''} ${isTabModified ? 'modified' : ''}`}
                                                onClick={() => setActiveGrade(grade)}
                                            >
                                                {grade}. osztály {isTabModified && '*'}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="action-buttons">
                                <button
                                    className="action-btn btn-reset"
                                    onClick={() => setIsConfirmOpen(true)}
                                    title="Alapértelmezett NAT visszaállítása a jelenlegi évfolyamon"
                                >
                                    <FaUndo /> Visszaállítás
                                </button>
                                <button
                                    className="action-btn btn-save"
                                    onClick={handleSave}
                                    disabled={saving || modifiedGrades.size === 0}
                                >
                                    <FaSave /> {saving ? 'Mentés...' : 'Mentés'}
                                </button>
                            </div>
                        </div>

                        {/* Success / Error Messages */}
                        {successMessage && (
                            <div className="toast-success-banner animate-slide-in">
                                <FaCheckCircle /> {successMessage}
                            </div>
                        )}
                        {error && (
                            <div className="toast-error-banner animate-slide-in">
                                <FaExclamationCircle /> {error}
                            </div>
                        )}

                        {/* Topics List Card */}
                        <div className="topics-card glass-card">
                            <div className="card-header-row">
                                <h2>Témakörök listája</h2>
                                <button className="add-topic-btn" onClick={handleAddTopic}>
                                    <FaPlus /> Új témakör hozzáadása
                                </button>
                            </div>

                            {loading ? (
                                <div className="spinner-wrapper">
                                    <LoadingSpinner />
                                </div>
                            ) : currentTopics.length === 0 ? (
                                <div className="empty-state">
                                    <FaBook className="empty-icon" />
                                    <p>Nincsenek témakörök ehhez a tantervhez ezen az évfolyamon. Kattints az "Új témakör hozzáadása" gombra!</p>
                                </div>
                            ) : (
                                <div className="topics-list">
                                    {currentTopics.map((topic, index) => {
                                        const isExpanded = expandedTopicId === topic.id;
                                        return (
                                            <div
                                                key={topic.id || index}
                                                className={`topic-row-card ${isExpanded ? 'expanded' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragEnd={handleDragEnd}
                                            >
                                                {/* Header area of topic card */}
                                                <div className="topic-card-header">
                                                    <div className="drag-handle" title="Húzd a sorrend módosításához">
                                                        <FaGripVertical />
                                                    </div>

                                                    <div className="topic-meta-inputs">
                                                        <div className="input-group-name">
                                                            <FaEdit className="input-icon" />
                                                            <input
                                                                type="text"
                                                                value={topic.name}
                                                                onChange={(e) => handleTopicFieldChange(index, 'name', e.target.value)}
                                                                placeholder="Témakör neve"
                                                                className="topic-name-input"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="topic-actions">
                                                        {/* Reassign buttons */}
                                                        {prevGrade && (
                                                            <button
                                                                className="move-grade-btn prev"
                                                                onClick={() => handleMoveGrade(index, activeGrade, prevGrade)}
                                                                title={`Áthelyezés ide: ${prevGrade}. osztály`}
                                                            >
                                                                <FaArrowLeft /> {prevGrade}. o.
                                                            </button>
                                                        )}
                                                        {nextGrade && (
                                                            <button
                                                                className="move-grade-btn next"
                                                                onClick={() => handleMoveGrade(index, activeGrade, nextGrade)}
                                                                title={`Áthelyezés ide: ${nextGrade}. osztály`}
                                                            >
                                                                {nextGrade}. o. <FaArrowRight />
                                                            </button>
                                                        )}
                                                        
                                                        <button
                                                            className="expand-btn"
                                                            onClick={() => toggleExpand(topic.id)}
                                                            title={isExpanded ? 'Részletek összecsukása' : 'Részletek kibontása'}
                                                        >
                                                            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                                        </button>
                                                        <button
                                                            className="delete-btn"
                                                            onClick={() => handleDeleteTopic(index)}
                                                            title="Témakör törlése"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Expanded details section */}
                                                {isExpanded && (
                                                    <div className="topic-card-details animate-slide-down">
                                                        <div className="details-grid">
                                                            <div className="textarea-group">
                                                                <label>Tanulási eredmények</label>
                                                                <textarea
                                                                    value={topic.learningOutcomes || ''}
                                                                    onChange={(e) => handleTopicFieldChange(index, 'learningOutcomes', e.target.value)}
                                                                    placeholder="Milyen készségeket/tudást szereznek a tanulók? (Pl.: A tanuló képes értelmezni a szöveget...)"
                                                                />
                                                            </div>
                                                            <div className="textarea-group">
                                                                <label>Fejlesztési feladatok és ismeretek</label>
                                                                <textarea
                                                                    value={topic.developmentalTasks || ''}
                                                                    onChange={(e) => handleTopicFieldChange(index, 'developmentalTasks', e.target.value)}
                                                                    placeholder="Milyen témákat, ismereteket és készségfejlesztéseket tartalmaz a témakör?"
                                                                />
                                                            </div>
                                                            <div className="textarea-group">
                                                                <label>Kulcsfogalmak</label>
                                                                <textarea
                                                                    value={topic.concepts || ''}
                                                                    onChange={(e) => handleTopicFieldChange(index, 'concepts', e.target.value)}
                                                                    placeholder="Kulcsfontosságú fogalmak, szakkifejezések vesszővel elválasztva"
                                                                />
                                                            </div>
                                                            <div className="textarea-group">
                                                                <label>Javasolt tevékenységek</label>
                                                                <textarea
                                                                    value={topic.suggestedActivities || ''}
                                                                    onChange={(e) => handleTopicFieldChange(index, 'suggestedActivities', e.target.value)}
                                                                    placeholder="Milyen gyakorlatokat, kísérleteket, órai feladatokat ajánlasz a témakörhöz?"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Confirmation Modal */}
                <ConfirmModal
                    isOpen={isConfirmOpen}
                    title="Megerősítés"
                    message={`Biztosan vissza szeretnéd állítani a(z) ${activeSubject} (${activeGrade}. osztály) kerettantervét az eredeti nemzeti kerettanterv ajánlására? Minden saját változtatásod elvész ezen az évfolyamon.`}
                    onConfirm={handleResetConfirm}
                    onCancel={() => setIsConfirmOpen(false)}
                    confirmText="Igen, visszaállítom"
                    cancelText="Mégse"
                    type="warning"
                />
            </div>
        </div>
    );
};

export default CurriculumConfig;
