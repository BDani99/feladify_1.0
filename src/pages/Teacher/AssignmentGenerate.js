import React, { useState, useEffect, useRef } from 'react';
import { previewAssignment, saveAssignment } from '../../api/Assignments/Teacher/GenerateAssignment';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { API_BASE_URL } from '../../api/config';
import {
    FaExclamationCircle,
    FaCheckCircle,
    FaPen,
    FaListUl,
    FaCheck,
    FaLink,
    FaSortAmountDown,
    FaMinusSquare,
    FaClock,
    FaGraduationCap,
    FaBook,
    FaLayerGroup,
    FaBrain,
    FaEye,
    FaSync,
    FaChevronDown,
    FaUsers,
    FaChevronLeft,
    FaChevronRight,
    FaCalendarAlt
} from 'react-icons/fa';
import PreviewModal from '../../components/Teacher/PreviewModal';
import CustomSelect from '../../components/CustomSelect';
import CustomDatePicker from '../../components/CustomDatePicker';
import '../../styles/Teacher/AssignmentGenerate.css';


const DIFFICULTY_OPTIONS = [
    { id: 'Könnyített', label: 'Könnyített', desc: 'Alapfogalmak, egyszerű felismerés' },
    { id: 'Normál', label: 'Normál', desc: 'Standard tananyag, összefüggések' },
    { id: 'Kihívás', label: 'Kihívás', desc: 'Összetett problémák, elemzés' }
];

const QUESTION_TYPES = [
    { id: 'nyilt', label: 'Nyílt végű', icon: <FaPen />, defaultCount: 3 },
    { id: 'feleletvalasztos', label: 'Feleletválasztós', icon: <FaListUl />, defaultCount: 3 },
    { id: 'igaz_hamis', label: 'Igaz/Hamis', icon: <FaCheck />, defaultCount: 2 },
    { id: 'parositas', label: 'Párosítás', icon: <FaLink />, defaultCount: 2 },
    { id: 'sorbarendezes', label: 'Sorrend', icon: <FaSortAmountDown />, defaultCount: 2 },
    { id: 'hianyos_szoveg', label: 'Hiányos szöveg', icon: <FaMinusSquare />, defaultCount: 2 },
];

const AssignmentGenerate = ({ token }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [difficulty, setDifficulty] = useState('Normál');
    const [className, setClassName] = useState('');
    
    const [natTopics, setNatTopics] = useState([]);
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [loadingTopics, setLoadingTopics] = useState(false);
    
    const [activeTypes, setActiveTypes] = useState({
        nyilt: true,
        feleletvalasztos: false,
        igaz_hamis: false,
        parositas: false,
        sorbarendezes: false,
        hianyos_szoveg: false
    });
    
    const [typeCounts, setTypeCounts] = useState({
        nyilt: 3,
        feleletvalasztos: 3,
        igaz_hamis: 2,
        parositas: 2,
        sorbarendezes: 2,
        hianyos_szoveg: 2
    });

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [timeLimit, setTimeLimit] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [previewQuestions, setPreviewQuestions] = useState([]);
    const [lastPreviewQuestions, setLastPreviewQuestions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [teacherSubjects, setTeacherSubjects] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [showStudentSelector, setShowStudentSelector] = useState(false);

    useEffect(() => {
        if (className) {
            const selectedClassObj = classes.find(c => c.name === className);
            const studentIds = (selectedClassObj?.studentIds || []).map(s => s._id);
            setSelectedStudentIds(studentIds);
        } else {
            setSelectedStudentIds([]);
        }
    }, [className, classes]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [fetchedClasses, userData] = await Promise.all([
                    fetchTeacherClasses(token),
                    fetchUserData(),
                ]);
                setClasses(fetchedClasses);
                const subjects = userData.user?.subjects || userData.subjects || [];
                setTeacherSubjects(subjects);
                if (subjects.length === 1) {
                    setSubject(subjects[0]);
                }
            } catch (err) {
                setError(err.message || 'Nem sikerült betölteni az adatokat.');
            }
        };
        loadData();
    }, [token]);

    useEffect(() => {
        const fetchTopics = async () => {
            const isCurriculumSupported = (sub) => {
                if (!sub) return false;
                const s = sub.toLowerCase();
                return ['matematika', 'nyelvtan', 'irodalom', 'történelem', 'környezetismeret',
                        'fizika', 'biológia', 'biologia', 'földrajz', 'foldrajz'].includes(s);
            };

            if (subject && isCurriculumSupported(subject) && className) {
                const gradeMatch = className.match(/^(\d+)/);
                const gradeNum = gradeMatch ? parseInt(gradeMatch[1], 10) : null;
                if (gradeNum) {
                    setLoadingTopics(true);
                    try {
                        const response = await fetch(`${API_BASE_URL}/curriculum/topics?subject=${encodeURIComponent(subject)}&grade=${gradeNum}`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`,
                            }
                        });
                        if (response.ok) {
                            const data = await response.json();
                            if (data.available && Array.isArray(data.topics)) {
                                setNatTopics(data.topics);
                            } else {
                                setNatTopics([]);
                            }
                        } else {
                            setNatTopics([]);
                        }
                    } catch (err) {
                        console.error('Error fetching NAT topics:', err);
                        setNatTopics([]);
                    } finally {
                        setLoadingTopics(false);
                    }
                } else {
                    setNatTopics([]);
                }
            } else {
                setNatTopics([]);
                setSelectedTopics([]);
            }
        };
        fetchTopics();
    }, [subject, className]);

    const toggleType = (id) => {
        setActiveTypes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCountChange = (id, val) => {
        const num = Math.max(0, Math.min(20, parseInt(val) || 0));
        setTypeCounts(prev => ({ ...prev, [id]: num }));
        if (num > 0) setActiveTypes(prev => ({ ...prev, [id]: true }));
    };

    const generatePreview = async () => {
        setIsLoading(true);
        setMessage('');
        setError('');

        if (!subject) {
            setError('Válassz ki egy tantárgyat!');
            setIsLoading(false);
            return;
        }

        if (!className) {
            setError('Válassz ki egy osztályt!');
            setIsLoading(false);
            return;
        }

        const questionTypes = Object.entries(typeCounts)
            .filter(([type, count]) => activeTypes[type] && count > 0)
            .map(([type, count]) => ({ type, count }));

        if (questionTypes.length === 0) {
            setError('Legalább egy kérdéstípust válassz ki!');
            setIsLoading(false);
            return;
        }

        try {
            const data = await previewAssignment(title, subject, difficulty, className, questionTypes, selectedTopics);
            setPreviewQuestions(data.questions);
            setLastPreviewQuestions(data.questions);
            setShowModal(true);
        } catch (err) {
            setError(err.message || 'Hiba történt a generálás során.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        await generatePreview();
    };

    const handleSave = async (editedQuestions) => {
        setIsLoading(true);
        setError('');

        const selectedClassObj = classes.find(c => c.name === className);
        const classStudents = selectedClassObj?.studentIds || [];
        
        if (classStudents.length > 0 && selectedStudentIds.length === 0) {
            setError('Legalább egy diákot ki kell jelölnöd a kiküldéshez!');
            setIsLoading(false);
            return;
        }

        try {
            const data = await saveAssignment(
                title, subject, difficulty, className, editedQuestions,
                timeLimit ? Number(timeLimit) : null,
                startDate || null,
                dueDate || null,
                selectedStudentIds
            );
            setShowModal(false);
            setMessage(data.message || 'Dolgozat sikeresen létrehozva!');
            resetForm();
            setTimeout(() => setMessage(''), 5000);
        } catch (err) {
            setError(err.message || 'Hiba történt a mentés során.');
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setClassName('');
        setDifficulty('Normál');
        setTimeLimit('');
        setStartDate('');
        setDueDate('');
        setActiveTypes({ nyilt: true });
        setSelectedStudentIds([]);
        setShowStudentSelector(false);
        setSelectedTopics([]);
    };

    return (
        <div id="content">
            <div className="assignment-generate-container">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaBrain /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Dolgozat Generálás</h1>
                        <p className="phb-subtitle">Hozz létre professzionális feladatsorokat AI segítségével másodpercek alatt</p>
                    </div>
                </div>

                <div className="generate-grid">
                    <div className="generate-card main-config">
                        <form onSubmit={handleGenerate} className="generate-form">
                            <div className="section-title">
                                <FaLayerGroup /> Alapadatok
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label><FaBook /> Tantárgy</label>
                                    <CustomSelect 
                                        value={subject} 
                                        onChange={setSubject} 
                                        options={teacherSubjects} 
                                        placeholder="Válassz tantárgyat" 
                                        icon={<FaBook />} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label><FaGraduationCap /> Osztály</label>
                                    <CustomSelect 
                                        value={className} 
                                        onChange={setClassName} 
                                        options={classes.map(c => c.name)} 
                                        placeholder="Válassz osztályt" 
                                        icon={<FaGraduationCap />} 
                                    />
                                </div>
                            </div>

                            {className && (classes.find(c => c.name === className)?.studentIds || []).length > 0 && (
                                <div className="student-selector-group">
                                    <div 
                                        className={`student-selector-trigger ${showStudentSelector ? 'open' : ''}`}
                                        onClick={() => setShowStudentSelector(!showStudentSelector)}
                                    >
                                        <div className="trigger-left">
                                            <FaUsers className="users-icon" />
                                            <span>Diákok szűrése ({selectedStudentIds.length} / {(classes.find(c => c.name === className)?.studentIds || []).length} kijelölve)</span>
                                        </div>
                                        <FaChevronDown className="chevron-icon" />
                                    </div>
                                    
                                    {showStudentSelector && (
                                        <div className="student-selector-dropdown">
                                            <div className="dropdown-actions">
                                                <button 
                                                    type="button" 
                                                    className="action-btn" 
                                                    onClick={() => {
                                                        const sList = classes.find(c => c.name === className)?.studentIds || [];
                                                        setSelectedStudentIds(sList.map(s => s._id));
                                                    }}
                                                >
                                                    Összes kijelölése
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="action-btn outline" 
                                                    onClick={() => setSelectedStudentIds([])}
                                                >
                                                    Kijelölések törlése
                                                </button>
                                            </div>
                                            <div className="students-scroll-grid">
                                                {(classes.find(c => c.name === className)?.studentIds || []).map(student => {
                                                    const isChecked = selectedStudentIds.includes(student._id);
                                                    return (
                                                        <div 
                                                            key={student._id} 
                                                            className={`student-select-card ${isChecked ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                setSelectedStudentIds(prev => 
                                                                    prev.includes(student._id)
                                                                        ? prev.filter(id => id !== student._id)
                                                                        : [...prev, student._id]
                                                                );
                                                            }}
                                                        >
                                                            <div className="checkbox-indicator">
                                                                {isChecked && <FaCheck />}
                                                            </div>
                                                            <div className="student-info-block">
                                                                <div className="student-select-name">{student.name}</div>
                                                                <div className="student-select-email">{student.email}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {subject && ['matematika', 'nyelvtan', 'irodalom', 'történelem', 'környezetismeret'].includes(subject.toLowerCase()) && className && (
                                <div className="nat-topics-container">
                                    <label className="nat-topics-label"><FaBrain /> Nemzeti Alaptantervi (NAT) Témakörök</label>
                                    {loadingTopics ? (
                                        <div className="nat-topics-loading">NAT témakörök betöltése...</div>
                                    ) : natTopics.length === 0 ? (
                                        <div className="nat-topics-empty">Ehhez a tantárgyhoz és évfolyamhoz jelenleg nem áll rendelkezésre a részletes nemzeti kerettanterv.</div>
                                    ) : (
                                        <div className="nat-topics-grid">
                                            {natTopics.map(topicItem => {
                                                const isSelected = selectedTopics.includes(topicItem.id);
                                                return (
                                                    <div 
                                                        key={topicItem.id} 
                                                        className={`nat-topic-chip ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setSelectedTopics(prev => {
                                                                const updated = prev.includes(topicItem.id)
                                                                    ? prev.filter(id => id !== topicItem.id)
                                                                    : [...prev, topicItem.id];
                                                                
                                                                const selectedNames = natTopics
                                                                    .filter(t => updated.includes(t.id))
                                                                    .map(t => t.name);
                                                                setTitle(selectedNames.join(', '));
                                                                
                                                                return updated;
                                                            });
                                                        }}
                                                    >
                                                        <div className="nat-chip-check">
                                                            {isSelected && <FaCheck />}
                                                        </div>
                                                        <div className="nat-chip-name">{topicItem.name}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Témakör</label>
                                <input
                                    type="text"
                                    placeholder='Pl. Szorzás és osztás, Petőfi Sándor élete...'
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="difficulty-selector">
                                <label>Nehézségi szint</label>
                                <div className="difficulty-options">
                                    {DIFFICULTY_OPTIONS.map(opt => (
                                        <div 
                                            key={opt.id} 
                                            className={`difficulty-card ${difficulty === opt.id ? 'active' : ''}`}
                                            onClick={() => setDifficulty(opt.id)}
                                        >
                                            <div className="diff-label">{opt.label}</div>
                                            <div className="diff-desc">{opt.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="section-title">
                                <FaClock /> Időzítés & Korlátok
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Időkorlát (perc)</label>
                                    <input type="number" placeholder="Opcionális" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Határidő</label>
                                    <CustomDatePicker 
                                         value={dueDate} 
                                         onChange={setDueDate} 
                                         type="datetime"
                                     />
                                </div>
                            </div>

                            <button type='submit' className="main-generate-btn" disabled={isLoading}>
                                {isLoading ? 'Generálás folyamatban...' : 'Dolgozat Előnézet'}
                                <FaBrain className="btn-icon" />
                            </button>
                            {lastPreviewQuestions.length > 0 && !showModal && (
                                <button
                                    type="button"
                                    className="prev-preview-btn"
                                    onClick={() => {
                                        setPreviewQuestions(lastPreviewQuestions);
                                        setShowModal(true);
                                    }}
                                >
                                    <FaEye /> Előző előnézet megtekintése
                                </button>
                            )}
                        </form>
                    </div>

                    <div className="generate-card type-selection">
                        <div className="section-title">
                            <FaListUl /> Kérdéstípusok beállítása
                        </div>
                        <p className="section-desc">Válaszd ki, milyen típusú feladatok szerepeljenek a dolgozatban.</p>
                        
                        <div className="types-list">
                            {QUESTION_TYPES.map(type => (
                                <div key={type.id} className={`type-item ${activeTypes[type.id] ? 'active' : ''}`}>
                                    <div className="type-info" onClick={() => toggleType(type.id)}>
                                        <div className="type-icon">{type.icon}</div>
                                        <div className="type-name">{type.label}</div>
                                    </div>
                                    <div className="type-controls">
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max="20" 
                                            value={typeCounts[type.id]} 
                                            onChange={(e) => handleCountChange(type.id, e.target.value)}
                                        />
                                        <span className="unit">db</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {message && <div className="success-message"><FaCheckCircle /> {message}</div>}
                        {error && <div className="error-message"><FaExclamationCircle /> {error}</div>}
                    </div>
                </div>
            </div>

            {showModal && (
                <PreviewModal
                    questions={previewQuestions}
                    onSave={handleSave}
                    onClose={() => setShowModal(false)}
                    onRegenerate={generatePreview}
                    isLoading={isLoading}
                />
            )}
        </div>
    );
};

export default AssignmentGenerate;
