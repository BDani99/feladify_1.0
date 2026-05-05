import React, { useState, useEffect } from 'react';
import { generateAssignment } from '../../api/Assignments/Teacher/GenerateAssignment';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import '../../styles/Teacher/AssignmentGenerate.css';

const AssignmentGenerate = ({ token }) => {
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [difficulty, setDifficulty] = useState('Könnyű');
    const [className, setClassName] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [classes, setClasses] = useState([]);

    useEffect(() => {
        const loadClasses = async () => {
            try {
                const fetchedClasses = await fetchTeacherClasses(token);
                setClasses(fetchedClasses);
            } catch (error) {
                setError(error.message || 'Hiba történt az osztályok betöltése során.');
            }
        };

        loadClasses();
    }, [token]);

    const handleGenerate = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        setError('');

        if (questionCount < 1 || questionCount > 20) {
            setError('A kérdések száma 1 és 20 között kell, hogy legyen!');
            setIsLoading(false);
            return;
        }

        try {
            const data = await generateAssignment(title, subject, difficulty, className, questionCount);
            setMessage(data.message || 'A dolgozat sikeresen legenerálva!');
            setTitle('');
            setSubject('');
            setDifficulty('Könnyű');
            setClassName('');
            setQuestionCount(5);

            setTimeout(() => {
                setMessage('');
            }, 3000);
        } catch (error) {
            setError(error.message || 'Hiba történt a dolgozat generálása során.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuestionCountChange = (e) => {
        const value = e.target.value;

        if (/^\d+$/.test(value) && value >= 1 && value <= 20) {
            setQuestionCount(Number(value));
        } else {
            setQuestionCount('');
        }
    };

    return (
        <div id="content">
            <div className="assignment-generate-container">
                <h1 className='title'>Dolgozat Generálás</h1>
                <div className='generate-scroll-container'>
                    <div className="generate-container">
                        <form onSubmit={handleGenerate} className="generate-form">
                            <div className="form-group">
                                <label htmlFor="title">Dolgozat címe</label>
                                <input
                                    type="text"
                                    placeholder='Kérlek add meg a dolgozat címét!'
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="subject">Tantárgy</label>
                                <input
                                    type="text"
                                    placeholder='Kérlek adj meg egy tantárgyat!'
                                    id="subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="difficulty">Dolgozat nehézsége</label>
                                <select
                                    id="difficulty"
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    required
                                >
                                    <option value="Könnyű">Könnyű</option>
                                    <option value="Közepes">Közepes</option>
                                    <option value="Nehéz">Nehéz</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="className">Osztály neve</label>
                                <select
                                    id="className"
                                    value={className}
                                    onChange={(e) => setClassName(e.target.value)}
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
                                <label htmlFor="questionCount">Kérdések száma</label>
                                <input
                                    type="number"
                                    id="questionCount"
                                    value={questionCount}
                                    onChange={handleQuestionCountChange}
                                    min="1"
                                    max="20"
                                    required
                                />
                            </div>

                            <button type='submit' className="generate-button" disabled={isLoading}>
                                <div class="dots_border"></div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    class="sparkle"
                                >
                                    <path
                                        class="path"
                                        stroke-linejoin="round"
                                        stroke-linecap="round"
                                        stroke="black"
                                        fill="black"
                                        d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z"
                                    ></path>
                                    <path
                                        class="path"
                                        stroke-linejoin="round"
                                        stroke-linecap="round"
                                        stroke="black"
                                        fill="black"
                                        d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z"
                                    ></path>
                                    <path
                                        class="path"
                                        stroke-linejoin="round"
                                        stroke-linecap="round"
                                        stroke="black"
                                        fill="black"
                                        d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z"
                                    ></path>
                                </svg>
                                <span class="text_button">Dolgozat generálása</span>
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
                                {message && <p className="success-message">{message}</p>}
                                {error && <p className="error-message">{error}</p>}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssignmentGenerate;
