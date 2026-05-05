import React, { useState, useEffect } from 'react';
import { registerUser } from '../api/Auth/RegisterApi';
import { fetchClasses } from '../api/ClassesForReg';
import '../styles/Registration.css';
import logo from '../assets/logo-400.png';

const RegistrationForm = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'student',
        subject: '',
        className: '',
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [classes, setClasses] = useState([]);

    useEffect(() => {
        const loadClasses = async () => {
            try {
                const fetchedClasses = await fetchClasses();
                setClasses(fetchedClasses);
            } catch (error) {
                setError(error.message || 'Hiba történt az osztályok betöltése során.');
            }
        };

        loadClasses();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await registerUser(formData);
            setMessage(response.message);
            setError('');
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'student',
                subject: '',
                className: '',
            });
        } catch (error) {
            setError(error.message);
            setMessage('');
        }
    };

    return (
        <div className="registration-container">
            <form className="registration-form" onSubmit={handleSubmit}>
                <div className='login-images'>
                    <img src={logo} alt='logo' className='login-logo' />
                    <h1 className='login-name'>FELADIFY</h1>
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
                    <input
                        type="text"
                        name="subject"
                        placeholder="Tantárgy"
                        value={formData.subject}
                        onChange={handleChange}
                    />
                )}
                {formData.role === 'student' && (
                    <>
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
                    </>
                )}
                <button type="submit" className="main-button">Regisztráció</button>

                {message && <p className="success-message">{message}</p>}
                {error && <p className="error-message">{error}</p>}

                <div className="login-link">
                    Már van fiókod?{' '}
                    <a href="/bejelentkezes">Jelentkezz be</a>
                </div>
            </form>
        </div>
    );
};

export default RegistrationForm;
