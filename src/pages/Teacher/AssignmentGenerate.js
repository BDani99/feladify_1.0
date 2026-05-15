import React, { useState, useEffect } from 'react';
import { previewAssignment, saveAssignment } from '../../api/Assignments/Teacher/GenerateAssignment';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { fetchUserData } from '../../api/Auth/ProfileData';
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
    FaSync
} from 'react-icons/fa';
import PreviewModal from '../../components/Teacher/PreviewModal';
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

        const questionTypes = Object.entries(typeCounts)
            .filter(([type, count]) => activeTypes[type] && count > 0)
            .map(([type, count]) => ({ type, count }));

        if (questionTypes.length === 0) {
            setError('Legalább egy kérdéstípust válassz ki!');
            setIsLoading(false);
            return;
        }

        try {
            const data = await previewAssignment(title, subject, difficulty, className, questionTypes);
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
        try {
            const data = await saveAssignment(
                title, subject, difficulty, className, editedQuestions,
                timeLimit ? Number(timeLimit) : null,
                startDate || null,
                dueDate || null
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
    };

    return (
        <div id="content">
            <div className="assignment-generate-container">
                <header className="page-header">
                    <div className="header-icon"><FaBrain /></div>
                    <div className="header-text">
                        <h1 className="title">Dolgozat Generálás</h1>
                        <p className="subtitle">Hozz létre professzionális feladatsorokat AI segítségével másodpercek alatt.</p>
                    </div>
                </header>

                <div className="generate-grid">
                    <div className="generate-card main-config">
                        <form onSubmit={handleGenerate} className="generate-form">
                            <div className="section-title">
                                <FaLayerGroup /> Alapadatok
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label><FaBook /> Tantárgy</label>
                                    <select value={subject} onChange={(e) => setSubject(e.target.value)} required>
                                        <option value="">Válassz tantárgyat</option>
                                        {teacherSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label><FaGraduationCap /> Osztály</label>
                                    <select value={className} onChange={(e) => setClassName(e.target.value)} required>
                                        <option value="">Válassz osztályt</option>
                                        {classes.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

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
                                    <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
