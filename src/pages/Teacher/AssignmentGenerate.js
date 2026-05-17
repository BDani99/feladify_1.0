import React, { useState, useEffect, useRef } from 'react';
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
    FaSync,
    FaChevronDown,
    FaUsers,
    FaChevronLeft,
    FaChevronRight,
    FaCalendarAlt
} from 'react-icons/fa';
import PreviewModal from '../../components/Teacher/PreviewModal';
import '../../styles/Teacher/AssignmentGenerate.css';
const CustomSelect = ({ value, onChange, options, placeholder, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="custom-select-container" ref={containerRef}>
            <div 
                className={`custom-select-trigger ${isOpen ? 'open' : ''} ${value ? 'has-value' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="trigger-content">
                    {icon && <span className="select-icon">{icon}</span>}
                    <span>{value || placeholder}</span>
                </div>
                <FaChevronDown className="select-chevron" />
            </div>
            
            {isOpen && (
                <div className="custom-select-options">
                    {options.map((opt) => (
                        <div 
                            key={opt} 
                            className={`custom-select-option ${value === opt ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const HUNGARIAN_MONTHS = [
    'január', 'február', 'március', 'április', 'május', 'június',
    'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
];
const WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

const CustomDateTimePicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const containerRef = useRef(null);

    // Parse current value
    const dateObj = value ? new Date(value) : null;
    const selectedDate = dateObj;
    const selectedHour = dateObj ? dateObj.getHours() : 12;
    const selectedMinute = dateObj ? dateObj.getMinutes() : 0;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Format display date
    const getDisplayText = () => {
        if (!dateObj) return 'Nincs határidő megadva';
        const year = dateObj.getFullYear();
        const monthName = HUNGARIAN_MONTHS[dateObj.getMonth()];
        const day = dateObj.getDate();
        const hour = String(dateObj.getHours()).padStart(2, '0');
        const minute = String(dateObj.getMinutes()).padStart(2, '0');
        return `${year}. ${monthName} ${day}. ${hour}:${minute}`;
    };

    const handleMonthChange = (direction) => {
        setCurrentMonth(prev => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + direction);
            return next;
        });
    };

    const handleSelectDay = (dayObj) => {
        if (isPastDate(dayObj.year, dayObj.month, dayObj.day)) return;
        const newDate = new Date(dayObj.year, dayObj.month, dayObj.day);
        const formatted = formatDateTime(newDate, selectedHour, selectedMinute);
        onChange(formatted);
    };

    const handleSelectHour = (hour) => {
        const baseDate = selectedDate || new Date();
        const formatted = formatDateTime(baseDate, hour, selectedMinute);
        onChange(formatted);
    };

    const handleSelectMinute = (minute) => {
        const baseDate = selectedDate || new Date();
        const formatted = formatDateTime(baseDate, selectedHour, minute);
        onChange(formatted);
    };

    const handleToday = () => {
        const today = new Date();
        const formatted = formatDateTime(today, today.getHours(), today.getMinutes());
        onChange(formatted);
        setCurrentMonth(today);
    };

    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    const pad = (num) => String(num).padStart(2, '0');
    const formatDateTime = (date, hour, minute) => {
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        return `${year}-${month}-${day}T${pad(hour)}:${pad(minute)}`;
    };

    const isPastDate = (y, m, d) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateToCheck = new Date(y, m, d);
        return dateToCheck < today;
    };

    const isSameDay = (d1, y, m, d) => {
        if (!d1) return false;
        return d1.getFullYear() === y && d1.getMonth() === m && d1.getDate() === d;
    };

    // Calculate calendar grid
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1, ...
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const prevMonthDays = new Date(year, month, 0).getDate();
    const days = [];

    // Prev month days
    for (let i = startOffset - 1; i >= 0; i--) {
        days.push({
            day: prevMonthDays - i,
            month: month === 0 ? 11 : month - 1,
            year: month === 0 ? year - 1 : year,
            isCurrentMonth: false
        });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            day: i,
            month: month,
            year: year,
            isCurrentMonth: true
        });
    }

    // Next month filler
    const totalSlots = days.length <= 35 ? 35 : 42;
    const nextMonthFiller = totalSlots - days.length;
    for (let i = 1; i <= nextMonthFiller; i++) {
        days.push({
            day: i,
            month: month === 11 ? 0 : month + 1,
            year: month === 11 ? year + 1 : year,
            isCurrentMonth: false
        });
    }

    const hoursArray = Array.from({ length: 24 }, (_, i) => i);
    const minutesArray = Array.from({ length: 60 }, (_, i) => i);

    return (
        <div className="custom-datetime-container" ref={containerRef}>
            <div 
                className={`custom-datetime-trigger ${isOpen ? 'open' : ''} ${value ? 'has-value' : ''}`}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && dateObj) {
                        setCurrentMonth(dateObj);
                    }
                }}
            >
                <div className="trigger-content">
                    <FaCalendarAlt className="datetime-icon" />
                    <span>{getDisplayText()}</span>
                </div>
                <FaChevronDown className="datetime-chevron" />
            </div>

            {isOpen && (
                <div className="custom-datetime-dropdown">
                    <div className="picker-split-layout">
                        {/* LEFT: Calendar */}
                        <div className="picker-left-calendar">
                            <div className="calendar-header">
                                <button type="button" className="cal-nav-btn" onClick={() => handleMonthChange(-1)}>
                                    <FaChevronLeft />
                                </button>
                                <span className="calendar-current-month">
                                    {year}. {HUNGARIAN_MONTHS[month]}
                                </span>
                                <button type="button" className="cal-nav-btn" onClick={() => handleMonthChange(1)}>
                                    <FaChevronRight />
                                </button>
                            </div>

                            <div className="calendar-weekdays">
                                {WEEKDAYS.map(d => <span key={d} className="weekday-label">{d}</span>)}
                            </div>

                            <div className="calendar-grid">
                                {days.map((dayObj, idx) => {
                                    const isSelected = isSameDay(selectedDate, dayObj.year, dayObj.month, dayObj.day);
                                    const isPast = isPastDate(dayObj.year, dayObj.month, dayObj.day);
                                    
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            disabled={isPast}
                                            className={`calendar-day-btn ${dayObj.isCurrentMonth ? 'current-month' : 'other-month'} ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelectDay(dayObj)}
                                        >
                                            {dayObj.day}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="calendar-footer">
                                <button type="button" className="footer-action-btn today" onClick={handleToday}>
                                    Ma
                                </button>
                                <button type="button" className="footer-action-btn clear" onClick={handleClear}>
                                    Törlés
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: Time Selector */}
                        <div className="picker-right-time">
                            <div className="time-column-title">Óra</div>
                            <div className="time-scroll-list">
                                {hoursArray.map(h => (
                                    <div 
                                        key={h}
                                        className={`time-scroll-item ${selectedHour === h ? 'selected' : ''}`}
                                        onClick={() => handleSelectHour(h)}
                                    >
                                        {pad(h)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="picker-right-time">
                            <div className="time-column-title">Perc</div>
                            <div className="time-scroll-list">
                                {minutesArray.map(m => (
                                    <div 
                                        key={m}
                                        className={`time-scroll-item ${selectedMinute === m ? 'selected' : ''}`}
                                        onClick={() => handleSelectMinute(m)}
                                    >
                                        {pad(m)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

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
                                    <CustomDateTimePicker 
                                        value={dueDate} 
                                        onChange={setDueDate} 
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
