import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserData } from '../../api/Auth/ProfileData';
import '../../styles/Settings.css';

const TeacherSettings = () => {
    const [userData, setUserData] = useState({
        email: '',
        name: '',
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const userDataResponse = await fetchUserData();

                setUserData({
                    email: userDataResponse.user.email,
                    name: userDataResponse.user.name,
                });
                console.log(userDataResponse);
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
                        <button type="button" className="main-button">Mentés</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TeacherSettings;
