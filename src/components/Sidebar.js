import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaHome, FaClipboardCheck, FaChartBar, FaListAlt, FaClipboard, FaCog } from 'react-icons/fa';
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
                        <li>
                            <a className={isActiveLink('/') ? 'active-link' : ''} onClick={() => handleNavigation('/')}>
                                <FaHome className="icon" /> Kezdőlap
                            </a>
                        </li>
                        <li>
                            <a className={isActiveLink('/dolgozat-generalas') ? 'active-link' : ''} onClick={() => handleNavigation('/dolgozat-generalas')}>
                                <FaListAlt className="icon" /> Dolgozat Generálás
                            </a>
                        </li>
                        <li>
                            <a className={isActiveLink('/generalt-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/generalt-dolgozatok')}>
                                <FaClipboard className="icon" /> Generált Dolgozatok
                            </a>
                        </li>
                        <li>
                            <a className={isActiveLink('/statisztika') ? 'active-link' : ''} onClick={() => handleNavigation('/statisztika')}>
                                <FaChartBar className="icon" /> Statisztika
                            </a>
                        </li>
                        <div className="settings-link">
                            <a id="settings-link" className={isActiveLink('/tanar-beallitasok') ? 'settings-active' : ''} onClick={() => handleNavigation('/tanar-beallitasok')}>
                                <FaCog className="settings-icon" />
                            </a>
                        </div>
                    </>
                )}

                {userRole === 'student' && (
                    <>
                        <li>
                            <a className={isActiveLink('/') ? 'active-link' : ''} onClick={() => handleNavigation('/')}>
                                <FaHome className="icon" /> Kezdőlap
                            </a>
                        </li>
                        <li>
                            <a className={isActiveLink('/elerheto-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/elerheto-dolgozatok')}>
                                <FaListAlt className="icon" /> Elérhető Dolgozatok
                            </a>
                        </li>
                        <li>
                            <a className={isActiveLink('/megoldott-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/megoldott-dolgozatok')}>
                                <FaClipboardCheck className="icon" /> Megoldott Dolgozatok
                            </a>
                        </li>
                        <li>
                            <a className={isActiveLink('/tanulo-statisztika') ? 'active-link' : ''} onClick={() => handleNavigation('/tanulo-statisztika')}>
                                <FaChartBar className="icon" /> Statisztika
                            </a>
                        </li>
                        <div className="settings-link">
                            <a id="settings-link" className={isActiveLink('/diak-beallitasok') ? 'settings-active' : ''} onClick={() => handleNavigation('/diak-beallitasok')}>
                                <FaCog className="settings-icon" />
                            </a>
                        </div>
                    </>
                )}
            </ul>
        </nav>
    );
};

export default Sidebar;
