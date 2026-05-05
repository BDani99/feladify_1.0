import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserData } from '../../api/Auth/ProfileData';
import { fetchTeacherClasses } from '../../api/Assignments/Teacher/GetClasses';
import { updateProfile } from '../../api/Auth/UpdateProfile';
import { fetchAllClasses, createClass, updateTeacherClasses } from '../../api/Classes/ClassApi';
import '../../styles/Settings.css';

const CANONICAL_SUBJECTS = ['Nyelvtan', 'Irodalom', 'Angol', 'Matematika', 'Környezetismeret'];

const TeacherSettings = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [myClassIds, setMyClassIds] = useState([]);
    const [newClassName, setNewClassName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCreatingClass, setIsCreatingClass] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [saveError, setSaveError] = useState('');
    const [classError, setClassError] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [userResp, allCls, myCls] = await Promise.all([
                    fetchUserData(),
                    fetchAllClasses(),
                    fetchTeacherClasses(),
                ]);
                setName(userResp.user.name || '');
                setEmail(userResp.user.email || '');
                setSelectedSubjects(userResp.user.subjects || []);
                setAllClasses(allCls || []);
                setMyClassIds((myCls || []).map(c => c._id));
            } catch (error) {
                console.error('Hiba az adatok betöltése során:', error);
                setSaveError('Hiba történt az adatok betöltése során.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const toggleSubject = (subject) => {
        setSelectedSubjects(prev =>
            prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
        );
    };

    const toggleClass = (classId) => {
        setMyClassIds(prev =>
            prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
        );
    };

    const handleCreateClass = async () => {
        if (!newClassName.trim()) return;
        setIsCreatingClass(true);
        setClassError('');
        try {
            const result = await createClass(newClassName.trim());
            setAllClasses(prev => [...prev, result.class]);
            setMyClassIds(prev => [...prev, result.class._id]);
            setNewClassName('');
        } catch (err) {
            setClassError(err.message);
        } finally {
            setIsCreatingClass(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveMessage('');
        setSaveError('');
        try {
            await Promise.all([
                updateProfile({ name, email, subjects: selectedSubjects }),
                updateTeacherClasses(myClassIds),
            ]);
            setSaveMessage('Beállítások sikeresen mentve.');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
            setSaveError(err.message);
        } finally {
            setIsSaving(false);
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
                        <form className="settings-form" onSubmit={handleSave}>

                            <div className="card settings-card">
                                <div className="card-body">
                                    <h5 className="card-title">Személyes adatok</h5>
                                    <div className="form-group">
                                        <label htmlFor="name">Név:</label>
                                        <input
                                            type="text"
                                            id="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="email">Email:</label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="card settings-card">
                                <div className="card-body">
                                    <h5 className="card-title">Tantárgyak</h5>
                                    <div className="form-group2">
                                        <div className="checkbox-group">
                                            {CANONICAL_SUBJECTS.map(subject => (
                                                <label key={subject} className="subject-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSubjects.includes(subject)}
                                                        onChange={() => toggleSubject(subject)}
                                                    />
                                                    {subject}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card settings-card">
                                <div className="card-body">
                                    <h5 className="card-title">Osztályok</h5>
                                    <div className="form-group2">
                                        <div className="checkbox-group">
                                            {allClasses.map(cls => (
                                                <label key={cls._id} className="subject-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={myClassIds.includes(cls._id)}
                                                        onChange={() => toggleClass(cls._id)}
                                                    />
                                                    {cls.name}
                                                </label>
                                            ))}
                                        </div>
                                        <div className="class-create-row">
                                            <input
                                                type="text"
                                                placeholder="Új osztály neve..."
                                                value={newClassName}
                                                onChange={(e) => setNewClassName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleCreateClass();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="class-create-btn"
                                                onClick={handleCreateClass}
                                                disabled={isCreatingClass || !newClassName.trim()}
                                            >
                                                {isCreatingClass ? '...' : 'Létrehozás'}
                                            </button>
                                        </div>
                                        {classError && <p className="settings-error">{classError}</p>}
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="main-button" disabled={isSaving}>
                                {isSaving ? 'Mentés...' : 'Mentés'}
                            </button>

                            {saveMessage && <p className="settings-success">{saveMessage}</p>}
                            {saveError && <p className="settings-error">{saveError}</p>}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherSettings;
