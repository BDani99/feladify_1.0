import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaHome, FaClipboardCheck, FaChartBar, FaListAlt, FaClipboard, FaCog, FaCompass, FaGraduationCap, FaTachometerAlt, FaTasks, FaRobot } from 'react-icons/fa';
import '../styles/Sidebar.css';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, userRole }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const sidebarRef = useRef(null);

    const handleNavigation = (to) => {
        navigate(to);
        setIsSidebarOpen(false);
    };

    const isActiveLink = (path) => location.pathname === path;

    const handleClickOutside = (event) => {
        if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
            setIsSidebarOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <nav ref={sidebarRef} className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
            <ul className={`list-unstyled ${isSidebarOpen ? '' : 'hidden'}`}>
                {userRole === 'teacher' && (
                    <>
                        <li className="new-chat-li">
                            <button className="new-chat-btn" onClick={() => handleNavigation('/')}>
                                <FaRobot /> AI Asszisztens
                            </button>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/iranyitopult') ? 'active-link' : ''} onClick={() => handleNavigation('/iranyitopult')}>
                                <FaTachometerAlt className="icon" /> Irányítópult
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/dolgozat-generalas') ? 'active-link' : ''} onClick={() => handleNavigation('/dolgozat-generalas')}>
                                <FaListAlt className="icon" /> Dolgozat Generálás
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/generalt-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/generalt-dolgozatok')}>
                                <FaClipboard className="icon" /> Generált Dolgozatok
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/statisztika') ? 'active-link' : ''} onClick={() => handleNavigation('/statisztika')}>
                                <FaChartBar className="icon" /> Statisztika
                            </a>
                        </li>
                        <li className="settings-link">
                            <a id="settings-link" tabIndex={0} className={isActiveLink('/tanar-beallitasok') ? 'settings-active' : ''} onClick={() => handleNavigation('/tanar-beallitasok')}>
                                <FaCog className="settings-icon" /> Beállítások
                            </a>
                        </li>
                    </>
                )}

                {userRole === 'student' && (
                    <>
                        <li className="new-chat-li">
                            <button className="new-chat-btn" onClick={() => handleNavigation('/')}>
                                <FaRobot /> AI Mentor
                            </button>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/teendoim') ? 'active-link' : ''} onClick={() => handleNavigation('/teendoim')}>
                                <FaTasks className="icon" /> Teendőim
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/egyeni-gyakorlas') ? 'active-link' : ''} onClick={() => handleNavigation('/egyeni-gyakorlas')}>
                                <FaCompass className="icon" /> Egyéni Gyakorlás
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/elerheto-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/elerheto-dolgozatok')}>
                                <FaGraduationCap className="icon" /> Dolgozatok
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/megoldott-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/megoldott-dolgozatok')}>
                                <FaClipboardCheck className="icon" /> Eredmények
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/tanulo-statisztika') ? 'active-link' : ''} onClick={() => handleNavigation('/tanulo-statisztika')}>
                                <FaChartBar className="icon" /> Statisztika
                            </a>
                        </li>
                        <li className="settings-link">
                            <a id="settings-link" tabIndex={0} className={isActiveLink('/diak-beallitasok') ? 'settings-active' : ''} onClick={() => handleNavigation('/diak-beallitasok')}>
                                <FaCog className="settings-icon" /> Beállítások
                            </a>
                        </li>
                    </>
                )}
            </ul>
        </nav>
    );
};

export default Sidebar;