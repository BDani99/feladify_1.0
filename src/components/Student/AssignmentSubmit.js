import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { submitAssignment } from '../../api/Assignments/Student/SubmitAssignment';
import '../../styles/Student/AssignmentSubmit.css';

const AssignmentSubmitForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { assignment } = location.state || {};
    const [answers, setAnswers] = useState({});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        if (!assignment) {
            setError('Dolgozat nem található.');
        }
    }, [assignment]);

    const handleAnswerChange = (questionId, value) => {
        setAnswers((prevAnswers) => ({
            ...prevAnswers,
            [questionId]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');
        setError('');

        try {
            const response = await submitAssignment(assignment._id, answers);
            setMessage(response.message || 'Dolgozat sikeresen beküldve.');
            setIsSubmitted(true);
            navigate('/megoldott-dolgozatok');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (error) return <div>{error}</div>;

    return (
        <div id="content">
            <div className="assignment-submit-container">
                <h1 className="title">{assignment.title}</h1>
                <div className="assignment-submit-form">
                    {isSubmitted ? (
                        <p className="success-message">{message}</p>
                    ) : isSubmitting ? (
                        <div className="generate-loading-container">
                            <div className="generate-loading-text">Dolgozat Beküldése</div>
                            <div className="loading-dots">
                                <span className="dot">.</span>
                                <span className="dot">.</span>
                                <span className="dot">.</span>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className='assignment-form'>
                            <div className='question-container'>
                                {assignment.questions.map((question, index) => {
                                    const isMC = Array.isArray(question.options) && question.options.length > 0;
                                    return (
                                        <div key={question._id} className="question-box">
                                            <label>
                                                {index + 1}. {question.questionText}
                                            </label>
                                            {isMC ? (
                                                <div className="mc-options">
                                                    {question.options.map((opt) => (
                                                        <label key={opt} className="mc-option-label">
                                                            <input
                                                                type="radio"
                                                                name={question._id}
                                                                value={opt}
                                                                checked={answers[question._id] === opt}
                                                                onChange={() => handleAnswerChange(question._id, opt)}
                                                                required
                                                            />
                                                            {opt}
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    id={question._id}
                                                    onChange={(e) => handleAnswerChange(question._id, e.target.value)}
                                                    placeholder="Add meg a válaszod!"
                                                    required
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <button
                                type="submit"
                                className="assign-button"
                                disabled={isSubmitting}
                            >
                                Dolgozat beküldése
                            </button>
                        </form>
                    )}
                    {error && <p className="error-message">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default AssignmentSubmitForm;
