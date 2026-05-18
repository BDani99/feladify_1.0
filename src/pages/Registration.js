import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../api/Auth/RegisterApi';
import { fetchAllClasses } from '../api/Classes/ClassApi';
import CustomSelect from '../components/CustomSelect';
import { FaExclamationCircle, FaEye, FaEyeSlash, FaUserGraduate, FaChalkboardTeacher, FaUserFriends } from 'react-icons/fa';
import '../styles/Login.css';
import logo from '../assets/logo-400.png';
import nameImg from '../assets/name.png';

const CANONICAL_SUBJECTS = ['Nyelvtan', 'Irodalom', 'Angol', 'Matematika', 'Környezetismeret'];

const ROLES = [
    { value: 'student', label: 'Diák', icon: <FaUserGraduate /> },
    { value: 'teacher', label: 'Tanár', icon: <FaChalkboardTeacher /> },
    { value: 'parent', label: 'Szülő', icon: <FaUserFriends /> },
];

const RegistrationForm = () => {
    const navigate = useNavigate();

    const [role, setRole] = useState('student');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        subjects: [],
        classIds: [],
        className: '',
        childEmails: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [classes, setClasses] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadClasses = async () => {
            try {
                const fetched = await fetchAllClasses();
                if (isMounted) setClasses(fetched);
            } catch (err) {
                if (isMounted) setError(err.message || 'Hiba az osztályok betöltésekor.');
            }
        };
        loadClasses();
        return () => { isMounted = false; };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        setError('');
        setFormData((prev) => ({
            ...prev,
            subjects: [],
            classIds: [],
            className: '',
            childEmails: '',
        }));
    };

    const handleSubjectToggle = (subject) => {
        setFormData((prev) => ({
            ...prev,
            subjects: prev.subjects.includes(subject)
                ? prev.subjects.filter((s) => s !== subject)
                : [...prev.subjects, subject],
        }));
    };

    const handleClassToggle = (classId) => {
        setFormData((prev) => ({
            ...prev,
            classIds: prev.classIds.includes(classId)
                ? prev.classIds.filter((id) => id !== classId)
                : [...prev.classIds, classId],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('A két jelszó nem egyezik meg.');
            return;
        }
        if (role === 'teacher' && formData.subjects.length === 0) {
            setError('Legalább egy tantárgyat kötelező kiválasztani.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role,
                ...(role === 'teacher' ? {
                    subjects: formData.subjects,
                    classIds: formData.classIds,
                } : {}),
                ...(role === 'student' ? { className: formData.className } : {}),
                ...(role === 'parent' ? { childEmails: formData.childEmails } : {}),
            };
            await registerUser(payload);
            navigate('/bejelentkezes', { state: { email: formData.email } });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const classOptions = classes.map((c) => ({ value: c.name, label: c.name }));

    return (
        <div className="registration-container">
            <form className="registration-form" onSubmit={handleSubmit}>
                <div className="login-images">
                    <img src={logo} alt="logo" className="login-logo" />
                    <img src={nameImg} alt="Feladify" className="login-name" />
                </div>
                <h2>Regisztráció</h2>

                <div className="role-tabs">
                    {ROLES.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            className={`role-tab${role === r.value ? ' active' : ''}`}
                            onClick={() => handleRoleChange(r.value)}
                        >
                            {r.icon}
                            {r.label}
                        </button>
                    ))}
                </div>

                <hr className="form-divider" />

                <div className="form-field">
                    <label className="form-label" htmlFor="reg-name">Teljes név</label>
                    <input
                        type="text"
                        id="reg-name"
                        name="name"
                        placeholder="Pl. Kiss János"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-field">
                    <label className="form-label" htmlFor="reg-email">E-mail cím</label>
                    <input
                        type="email"
                        id="reg-email"
                        name="email"
                        placeholder="pelda@email.hu"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-field">
                    <label className="form-label" htmlFor="reg-password">Jelszó</label>
                    <div className="password-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="reg-password"
                            name="password"
                            placeholder="Legalább 6 karakter"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>

                <div className="form-field">
                    <label className="form-label" htmlFor="reg-confirm">Jelszó megerősítése</label>
                    <div className="password-wrapper">
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            id="reg-confirm"
                            name="confirmPassword"
                            placeholder="Írd be újra a jelszót"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowConfirm((v) => !v)}
                            tabIndex={-1}
                        >
                            {showConfirm ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>

                {role === 'student' && (
                    <div className="form-field">
                        <label className="form-label">Osztály</label>
                        <CustomSelect
                            value={formData.className}
                            onChange={(val) => setFormData((prev) => ({ ...prev, className: val }))}
                            options={classOptions}
                            placeholder="Válassz osztályt"
                        />
                    </div>
                )}

                {role === 'teacher' && (
                    <>
                        <div className="form-field">
                            <span className="form-label">Tantárgyak (legalább 1)</span>
                            <div className="toggle-btn-grid">
                                {CANONICAL_SUBJECTS.map((subject) => (
                                    <button
                                        key={subject}
                                        type="button"
                                        className={`toggle-btn${formData.subjects.includes(subject) ? ' active' : ''}`}
                                        onClick={() => handleSubjectToggle(subject)}
                                    >
                                        {subject}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {classes.length > 0 && (
                            <div className="form-field">
                                <span className="form-label">Kezelt osztályok (opcionális)</span>
                                <div className="toggle-btn-grid">
                                    {classes.map((cls) => (
                                        <button
                                            key={cls._id}
                                            type="button"
                                            className={`toggle-btn${formData.classIds.includes(cls._id) ? ' active' : ''}`}
                                            onClick={() => handleClassToggle(cls._id)}
                                        >
                                            {cls.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {role === 'parent' && (
                    <div className="form-field">
                        <label className="form-label" htmlFor="reg-children">Gyermek(ek) e-mail címe</label>
                        <input
                            type="text"
                            id="reg-children"
                            name="childEmails"
                            placeholder="pelda@email.hu, masik@email.hu"
                            value={formData.childEmails}
                            onChange={handleChange}
                            required
                        />
                    </div>
                )}

                {error && (
                    <p className="error-message">
                        <FaExclamationCircle />
                        {error}
                    </p>
                )}

                <button type="submit" className="main-button" disabled={isSubmitting}>
                    {isSubmitting ? 'Regisztráció...' : 'Regisztráció'}
                </button>

                <div className="login-link">
                    Már van fiókod?{' '}
                    <a href="/bejelentkezes">Jelentkezz be</a>
                </div>
            </form>
        </div>
    );
};

export default RegistrationForm;
