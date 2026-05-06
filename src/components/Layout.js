import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import Sidebar from './Sidebar';
import Header from './Header';
import WelcomePage from '../pages/Teacher/TeacherWelcome';
import DolgozatGeneralasPage from '../pages/Teacher/AssignmentGenerate';
import GeneratedAssignments from '../pages/Teacher/GeneratedAssignments';
import StatisztikaPage from '../pages/Teacher/TeacherStatistics';
import AssignmentDetails from './Teacher/AssignmentDetailsPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/Registration';
import AvaiableAssignments from '../pages/Student/AvaiableAssignments';
import SolvedAssignments from '../pages/Student/CompletedAssignments';
import StudentStatistics from '../pages/Student/StudentStatistics';
import AssignmentSubmit from './Student/AssignmentSubmit';
import StudentWelcome from '../pages/Student/StudentWelcome';
import { FaBars, FaTimes } from 'react-icons/fa';
import CompletedDetails from './Student/CompletedDetails';
import TeacherSettings from '../pages/Teacher/TeacherSettings';
import StudentSettings from '../pages/Student/StudentSettings';
import AdaptiveRoadmap from '../pages/Student/AdaptiveRoadmap';
import DiagnosticIntro from '../pages/Student/DiagnosticIntro';
import DiagnosticTest from '../pages/Student/DiagnosticTest';
import DiagnosticResult from '../pages/Student/DiagnosticResult';

const Layout = ({ onLoginSuccess }) => {
    const { user } = useUser() || {};
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    if (!isLoggedIn) {
        return (
            <Routes>
                <Route path="/bejelentkezes" element={<LoginPage onLoginSuccess={onLoginSuccess} />} />
                <Route path="/regisztracio" element={<RegisterPage />} />
                <Route path="*" element={<Navigate to="/bejelentkezes" />} />
            </Routes>
        );
    }

    return (
        <>
            {isLoggedIn && (
                <>
                    <Header />
                    <button className="sidebar-toggle" onClick={toggleSidebar}>
                        {isSidebarOpen ? <FaTimes /> : <FaBars />}
                    </button>
                    <Sidebar
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        userRole={user?.role}
                    />
                </>
            )}

            <Routes>
                <Route path="/" element={user?.role === 'teacher' ? <WelcomePage /> : <StudentWelcome />} />
                <Route path="/bejelentkezes" element={<Navigate to="/" />} />
                <Route path="/regisztracio" element={<Navigate to="/" />} />

                {user?.role === 'teacher' && (
                    <>
                        <Route path="/dolgozat-generalas" element={<DolgozatGeneralasPage />} />
                        <Route path="/generalt-dolgozatok" element={<GeneratedAssignments />} />
                        <Route path="/statisztika" element={<StatisztikaPage />} />
                        <Route path="/generalt-dolgozatok/:id" element={<AssignmentDetails />} />
                        <Route path="/tanar-beallitasok" element={<TeacherSettings />} />
                    </>
                )}

                {user?.role === 'student' && (
                    <>
                        <Route path="/elerheto-dolgozatok" element={<AvaiableAssignments />} />
                        <Route path="/megoldott-dolgozatok" element={<SolvedAssignments />} />
                        <Route path="/megoldott-dolgozatok/:id" element={<CompletedDetails />} />
                        <Route path="/tanulo-statisztika" element={<StudentStatistics />} />
                        <Route path="/dolgozat/:id" element={<AssignmentSubmit />} />
                        <Route path="/diak-beallitasok" element={<StudentSettings />} />
                        <Route path="/egyeni-gyakorlas" element={<AdaptiveRoadmap />} />
                        
                        {/* Diagnosztikai teszt route-ok */}
                        <Route path="/diagnosztika/:subject" element={<DiagnosticIntro />} />
                        <Route path="/diagnosztika/:subject/teszt" element={<DiagnosticTest />} />
                        <Route path="/diagnosztika/:subject/eredmeny" element={<DiagnosticResult />} />
                    </>
                )}
            </Routes>
        </>
    );
};

export default Layout;
