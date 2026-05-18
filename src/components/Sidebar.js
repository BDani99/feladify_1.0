import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaTachometerAlt, FaChalkboardTeacher, FaBrain, FaClipboard, FaChartBar, FaCog, FaGraduationCap, FaBullseye, FaTasks, FaCompass, FaClipboardList, FaCheckCircle, FaFolderOpen, FaChalkboard } from 'react-icons/fa';
import '../styles/Sidebar.css';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, userRole }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const sidebarRef = useRef(null);

    const handleNavigation = (to, state = null) => {
        navigate(to, { state });
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
                            <button className={`new-chat-btn${isActiveLink('/ai-asszisztens') ? ' active' : ''}`} onClick={() => handleNavigation('/ai-asszisztens')}>
                                <FaChalkboardTeacher /> AI Asszisztens
                            </button>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/iranyitopult') ? 'active-link' : ''} onClick={() => handleNavigation('/iranyitopult')}>
                                <FaTachometerAlt className="icon" /> Irányítópult
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/dolgozat-generalas') ? 'active-link' : ''} onClick={() => handleNavigation('/dolgozat-generalas')}>
                                <FaBrain className="icon" /> Dolgozat Generálás
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/generalt-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/generalt-dolgozatok')}>
                                <FaClipboard className="icon" /> Generált Dolgozatok
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/dokumentumok') ? 'active-link' : ''} onClick={() => handleNavigation('/dokumentumok')}>
                                <FaFolderOpen className="icon" /> Dokumentumok
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/osztalyterem') ? 'active-link' : ''} onClick={() => handleNavigation('/osztalyterem')}>
                                <FaChalkboard className="icon" /> Osztályterem
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/statisztika') ? 'active-link' : ''} onClick={() => handleNavigation('/statisztika')}>
                                <FaChartBar className="icon" /> Statisztika
                            </a>
                        </li>
                        <li className="settings-link">
                            <a id="settings-link" tabIndex={0} className={isActiveLink('/tanar-beallitasok') ? 'settings-active' : ''} onClick={() => handleNavigation('/tanar-beallitasok', { activeTab: 'appearance' })}>
                                <FaCog className="settings-icon" /> Beállítások
                            </a>
                        </li>
                    </>
                )}

                {userRole === 'student' && (
                    <>
                        <li className="new-chat-li">
                            <button className={`new-chat-btn${isActiveLink('/ai-mentor') ? ' active' : ''}`} onClick={() => handleNavigation('/ai-mentor')}>
                                <FaGraduationCap /> AI Mentor
                            </button>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/teendoim') ? 'active-link' : ''} onClick={() => handleNavigation('/teendoim')}>
                                <FaTasks className="icon" /> Teendőim
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/szulo-celok') ? 'active-link' : ''} onClick={() => handleNavigation('/szulo-celok')}>
                                <FaBullseye className="icon" /> Célkitűzések
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/egyeni-gyakorlas') ? 'active-link' : ''} onClick={() => handleNavigation('/egyeni-gyakorlas')}>
                                <FaCompass className="icon" /> Egyéni Gyakorlás
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/elerheto-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/elerheto-dolgozatok')}>
                                <FaClipboardList className="icon" /> Dolgozatok
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/megoldott-dolgozatok') ? 'active-link' : ''} onClick={() => handleNavigation('/megoldott-dolgozatok')}>
                                <FaCheckCircle className="icon" /> Eredmények
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/dokumentumok') ? 'active-link' : ''} onClick={() => handleNavigation('/dokumentumok')}>
                                <FaFolderOpen className="icon" /> Dokumentumok
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/osztalyterem') ? 'active-link' : ''} onClick={() => handleNavigation('/osztalyterem')}>
                                <FaChalkboard className="icon" /> Osztályterem
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/tanulo-statisztika') ? 'active-link' : ''} onClick={() => handleNavigation('/tanulo-statisztika')}>
                                <FaChartBar className="icon" /> Statisztika
                            </a>
                        </li>
                        <li className="settings-link">
                            <a id="settings-link" tabIndex={0} className={isActiveLink('/diak-beallitasok') ? 'settings-active' : ''} onClick={() => handleNavigation('/diak-beallitasok', { activeTab: 'appearance' })}>
                                <FaCog className="settings-icon" /> Beállítások
                            </a>
                        </li>
                    </>
                )}
                {userRole === 'parent' && (
                    <>
                        <li className="new-chat-li">
                            <button className={`new-chat-btn${isActiveLink('/szulo-ai-tanacsado') ? ' active' : ''}`} onClick={() => handleNavigation('/szulo-ai-tanacsado')}>
                                <FaGraduationCap /> AI Tanácsadó
                            </button>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/szulo-iranyitopult') ? 'active-link' : ''} onClick={() => handleNavigation('/szulo-iranyitopult')}>
                                <FaTachometerAlt className="icon" /> Irányítópult
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/szulo-celok') ? 'active-link' : ''} onClick={() => handleNavigation('/szulo-celok')}>
                                <FaBullseye className="icon" /> Célkitűzések
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/szulo-eredmenyek') ? 'active-link' : ''} onClick={() => handleNavigation('/szulo-eredmenyek')}>
                                <FaCheckCircle className="icon" /> Eredmények
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/szulo-roadmap') ? 'active-link' : ''} onClick={() => handleNavigation('/szulo-roadmap')}>
                                <FaCompass className="icon" /> Fejlődési Térkép
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/szulo-osztalyterem') ? 'active-link' : ''} onClick={() => handleNavigation('/szulo-osztalyterem')}>
                                <FaChalkboard className="icon" /> Osztályterem
                            </a>
                        </li>
                        <li>
                            <a tabIndex={0} className={isActiveLink('/szulo-statisztika') ? 'active-link' : ''} onClick={() => handleNavigation('/szulo-statisztika')}>
                                <FaChartBar className="icon" /> Statisztikák
                            </a>
                        </li>
                        <li className="settings-link">
                            <a id="settings-link" tabIndex={0} className={isActiveLink('/szulo-beallitasok') ? 'settings-active' : ''} onClick={() => handleNavigation('/szulo-beallitasok', { activeTab: 'appearance' })}>
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