import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import '../../styles/Settings.css';

const TeacherSettings = () => {
    const [userData, setUserData] = useState({
        email: '',
        name: '',
        subjects: [],
        classes: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [newSubject, setNewSubject] = useState('');
    const [newClass, setNewClass] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const userDataResponse = await fetchUserData();
                const classesData = await fetchTeacherClasses();

                setUserData({
                    email: userDataResponse.user.email,
                    name: userDataResponse.user.name,
                    subjects: userDataResponse.user.subject ? [userDataResponse.user.subject] : [],
                    classes: classesData.map((classItem) => classItem.name) || []
                });
                console.log(userDataResponse, classesData);
            } catch (error) {
                console.error('Error loading user data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUserData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleDelete = (type, index) => {
        setUserData((prevData) => ({
            ...prevData,
            [type]: prevData[type].filter((_, i) => i !== index)
        }));
    };

    const handleAddSubject = () => {
        if (newSubject.trim()) {
            setUserData((prevData) => ({
                ...prevData,
                subjects: [...prevData.subjects, newSubject]
            }));
            setNewSubject('');
        }
    };

    const handleAddClass = () => {
        if (newClass.trim()) {
            setUserData((prevData) => ({
                ...prevData,
                classes: [...prevData.classes, newClass]
            }));
            setNewClass('');
        }
    };

    if (isLoading) {
        return (
            <div id="content">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div id="content">
            <div className="settings-container">
                <h1 className="title">Beállítások</h1>
                <div className='generate-scroll-container'>
                    <div className="generate-container">
                        <form className="settings-form">
                            <div className="form-group">
                                <label htmlFor="name">Név:</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={userData.name}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Email:</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={userData.email}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="form-group2">
                                <label>Tantárgyak:</label>
                                <div className="item-list">
                                    {userData.subjects.map((subject, index) => (
                                        <span key={index} className="item">
                                            {subject}
                                            <button type="button" onClick={() => handleDelete('subjects', index)}>X</button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={newSubject}
                                        placeholder="Új tantárgy hozzáadása"
                                        onChange={(e) => setNewSubject(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddSubject();
                                            }
                                        }}
                                    />
                                    <button className="settings-add-button" type="button" onClick={handleAddSubject}>Tantárgy hozzáadása</button>
                                </div>
                            </div>

                            <div className="form-group2">
                                <label>Osztályok:</label>
                                <div className="item-list">
                                    {userData.classes.map((classItem, index) => (
                                        <span key={index} className="item">
                                            {classItem}
                                            <button type="button" onClick={() => handleDelete('classes', index)}>X</button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={newClass}
                                        placeholder="Új osztály hozzáadása"
                                        onChange={(e) => setNewClass(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddClass();
                                            }
                                        }}
                                    />
                                    <button className="settings-add-button" type="button" onClick={handleAddClass}>Osztály hozzáadása</button>
                                </div>
                            </div>

                            <button type="submit" className="main-button">Mentés</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherSettings;
