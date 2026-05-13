import React, { useState, useEffect } from 'react';
import { previewAssignment, saveAssignment } from '../../api/Assignments/Teacher/GenerateAssignment';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import PreviewModal from '../../components/Teacher/PreviewModal';
import '../../styles/Teacher/AssignmentGenerate.css';

const DIFFICULTY_OPTIONS = ['Könnyített', 'Normál', 'Kihívás'];

const AssignmentGenerate = ({ token }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [difficulty, setDifficulty] = useState('Normál');
    const [className, setClassName] = useState('');
    const [nyiltChecked, setNyiltChecked] = useState(true);
    const [nyiltCount, setNyiltCount] = useState(3);
    const [feleletChecked, setFeleletChecked] = useState(false);
    const [feleletCount, setFeleletCount] = useState(3);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [timeLimit, setTimeLimit] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [previewQuestions, setPreviewQuestions] = useState([]);
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
                setError(err.message || 'Nem sikerült betölteni az adatokat. Kérjük, próbáld újra.');
            }
        };
        loadData();
    }, [token]);

    const handleClassChange = (e) => {
        setClassName(e.target.value);
        setDifficulty('Normál');
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        setError('');

        if (!subject) {
            setError('Kérjük, válassz ki egy tantárgyat a folytatáshoz.');
            setIsLoading(false);
            return;
        }

        if (!nyiltChecked && !feleletChecked) {
            setError('Legalább egy kérdéstípust be kell jelölni.');
            setIsLoading(false);
            return;
        }

        if (nyiltChecked && (nyiltCount < 1 || nyiltCount > 20)) {
            setError('A nyílt végű kérdések száma 1 és 20 között kell, hogy legyen!');
            setIsLoading(false);
            return;
        }

        if (feleletChecked && (feleletCount < 1 || feleletCount > 20)) {
            setError('A feleletválasztós kérdések száma 1 és 20 között kell, hogy legyen!');
            setIsLoading(false);
            return;
        }

        const questionTypes = [];
        if (nyiltChecked) questionTypes.push({ type: 'nyilt', count: nyiltCount });
        if (feleletChecked) questionTypes.push({ type: 'feleletvalasztos', count: feleletCount });

        try {
            const data = await previewAssignment(title, subject, difficulty, className, questionTypes);
            setPreviewQuestions(data.questions);
            setShowModal(true);
        } catch (err) {
            setError(err.message || 'Hiba történt a dolgozat generálása során.');
        } finally {
            setIsLoading(false);
        }
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
            setTitle('');
            setSubject(teacherSubjects.length === 1 ? teacherSubjects[0] : '');
            setDifficulty('Normál');
            setClassName('');
            setNyiltChecked(true);
            setNyiltCount(3);
            setFeleletChecked(false);
            setFeleletCount(3);
            setTimeLimit('');
            setStartDate('');
            setDueDate('');
            setTimeout(() => setMessage(''), 4000);
        } catch (err) {
            setError(err.message || 'Hiba történt a mentés során.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
        <div id="content">
            <div className="assignment-generate-container">
                <h1 className='title'>Dolgozat Generálás</h1>
                <div className='generate-scroll-container'>
                    <div className="generate-container">
                        <form onSubmit={handleGenerate} className="generate-form">
                            <div className="form-group">
                                <label htmlFor="title">Témakör</label>
                                <input
                                    type="text"
                                    placeholder='Pl. Szorzás és osztás, Magyar irodalom – Petőfi Sándor...'
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="subject">Tantárgy</label>
                                {teacherSubjects.length > 0 ? (
                                    <select
                                        id="subject"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    >
                                        <option value="">Válassz tantárgyat</option>
                                        {teacherSubjects.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="generate-info-text">
                                        Nincsenek tantárgyak beállítva. A <a href="/tanar-beallitasok" style={{color:'var(--accent)'}}>Beállítások</a> oldalon adhatsz hozzá tantárgyakat.
                                    </p>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="className">Osztály</label>
                                <select
                                    id="className"
                                    value={className}
                                    onChange={handleClassChange}
                                    required
                                >
                                    <option value="">Válassz osztályt</option>
                                    {classes.map((classItem) => (
                                        <option key={classItem._id} value={classItem.name}>
                                            {classItem.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="difficulty">Nehézségi szint</label>
                                <select
                                    id="difficulty"
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    required
                                >
                                    {DIFFICULTY_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Kérdés típusok</label>
                                <div className="question-type-row">
                                    <label className="qt-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={nyiltChecked}
                                            onChange={(e) => setNyiltChecked(e.target.checked)}
                                        />
                                        Nyílt végű
                                    </label>
                                    <input
                                        type="number"
                                        className="qt-count-input"
                                        value={nyiltCount}
                                        min="1"
                                        max="20"
                                        disabled={!nyiltChecked}
                                        onChange={(e) => setNyiltCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                    />
                                </div>
                                <div className="question-type-row">
                                    <label className="qt-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={feleletChecked}
                                            onChange={(e) => setFeleletChecked(e.target.checked)}
                                        />
                                        Feleletválasztós
                                    </label>
                                    <input
                                        type="number"
                                        className="qt-count-input"
                                        value={feleletCount}
                                        min="1"
                                        max="20"
                                        disabled={!feleletChecked}
                                        onChange={(e) => setFeleletCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="timeLimit">Időkorlát (perc, opcionális)</label>
                                <input
                                    type="number"
                                    id="timeLimit"
                                    min="1"
                                    max="180"
                                    placeholder="Pl. 45"
                                    value={timeLimit}
                                    onChange={(e) => setTimeLimit(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="startDate">Kezdő dátum (opcionális)</label>
                                <input
                                    type="datetime-local"
                                    id="startDate"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="dueDate">Határidő (opcionális)</label>
                                <input
                                    type="datetime-local"
                                    id="dueDate"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                            </div>

                            <button type='submit' className="generate-button" disabled={isLoading || teacherSubjects.length === 0}>
                                <div className="dots_border"></div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    className="sparkle"
                                >
                                    <path
                                        className="path"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        stroke="black"
                                        fill="black"
                                        d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z"
                                    ></path>
                                    <path
                                        className="path"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        stroke="black"
                                        fill="black"
                                        d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z"
                                    ></path>
                                    <path
                                        className="path"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        stroke="black"
                                        fill="black"
                                        d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z"
                                    ></path>
                                </svg>
                                <span className="text_button">Dolgozat generálása</span>
                            </button>
                        </form>

                        {isLoading ? (
                            <div className="generate-loading-container">
                                <div className="generate-loading-text">Dolgozat generálása</div>
                                <div className="loading-dots">
                                    <span className="dot">.</span>
                                    <span className="dot">.</span>
                                    <span className="dot">.</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {message && <p className="success-message"><FaCheckCircle />{message}</p>}
                                {error && <p className="error-message"><FaExclamationCircle />{error}</p>}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
        {showModal && (
            <PreviewModal
                questions={previewQuestions}
                onSave={handleSave}
                onClose={() => setShowModal(false)}
                isLoading={isLoading}
            />
        )}
        </>
    );
};

export default AssignmentGenerate;
