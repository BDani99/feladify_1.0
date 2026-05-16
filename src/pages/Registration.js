import React, { useState, useEffect } from 'react';
import { registerUser } from '../api/Auth/RegisterApi';
import { fetchAllClasses } from '../api/Classes/ClassApi';
import { FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import '../styles/Login.css';
import logo from '../assets/logo-400.png';
import name from '../assets/name.png';

const CANONICAL_SUBJECTS = ['Nyelvtan', 'Irodalom', 'Angol', 'Matematika', 'Környezetismeret'];

const RegistrationForm = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'student',
        subjects: [],
        className: '',
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [classes, setClasses] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadClasses = async () => {
            try {
                const fetchedClasses = await fetchAllClasses();
                if (isMounted) setClasses(fetchedClasses);
            } catch (err) {
                if (isMounted) setError(err.message || 'Hiba történt az osztályok betöltése során.');
            }
        };
        loadClasses();
        return () => { isMounted = false; };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubjectToggle = (subject) => {
        setFormData((prev) => ({
            ...prev,
            subjects: prev.subjects.includes(subject)
                ? prev.subjects.filter((s) => s !== subject)
                : [...prev.subjects, subject],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.role === 'teacher' && formData.subjects.length === 0) {
            setError('Legalább egy tantárgyat kötelező kiválasztani.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        setMessage('');
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                ...(formData.role === 'teacher' ? { subjects: formData.subjects } : { className: formData.className }),
            };
            const response = await registerUser(payload);
            setMessage(response.message);
            setFormData({ name: '', email: '', password: '', role: 'student', subjects: [], className: '' });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="registration-container">
            <form className="registration-form" onSubmit={handleSubmit}>
                <div className='login-images'>
                    <img src={logo} alt='logo' className='login-logo' />
                    <img src={name} alt='Feladify' className='login-name' />
                </div>
                <h2>Regisztráció</h2>
                <input
                    type="text"
                    name="name"
                    placeholder="Név"
                    value={formData.name}
                    onChange={handleChange}
                    required
                />
                <input
                    type="email"
                    name="email"
                    placeholder="E-mail"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
                <input
                    type="password"
                    name="password"
                    placeholder="Jelszó"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />
                <select name="role" value={formData.role} onChange={handleChange} required>
                    <option value="student">Diák</option>
                    <option value="teacher">Tanár</option>
                </select>

                {formData.role === 'teacher' && (
                    <div className="subjects-group">
                        <span className="subjects-label">Tantárgyak (legalább 1):</span>
                        {CANONICAL_SUBJECTS.map((subject) => (
                            <label key={subject} className="subject-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.subjects.includes(subject)}
                                    onChange={() => handleSubjectToggle(subject)}
                                />
                                {subject}
                            </label>
                        ))}
                    </div>
                )}

                {formData.role === 'student' && (
                    <select
                        name="className"
                        value={formData.className}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Válassz osztályt</option>
                        {classes.map((classItem) => (
                            <option key={classItem._id} value={classItem.name}>
                                {classItem.name}
                            </option>
                        ))}
                    </select>
                )}

                <button type="submit" className="main-button" disabled={isSubmitting}>
                    {isSubmitting ? 'Regisztráció...' : 'Regisztráció'}
                </button>

                {message && <p className="success-message"><FaCheckCircle />{message}</p>}
                {error && <p className="error-message"><FaExclamationCircle />{error}</p>}

                <div className="login-link">
                    Már van fiókod?{' '}
                    <a href="/bejelentkezes">Jelentkezz be</a>
                </div>
            </form>
        </div>
    );
};

export default RegistrationForm;
