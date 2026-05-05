import React from 'react';
import '../styles/LoadingSpinner.css';

const LoadingSpinner = () => {
    return (
        <div className="loading-container">
            <div className="loading-text">Betöltés</div>
            <div className="loading-dots">
                <span className="dot">.</span>
                <span className="dot">.</span>
                <span className="dot">.</span>
            </div>
        </div>
    );
};

export default LoadingSpinner;
