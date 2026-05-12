import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import Sidebar from './Sidebar';
import Header from './Header';
import WelcomePage from '../pages/Teacher/TeacherWelcome';
import AssignmentGeneratePage from '../pages/Teacher/AssignmentGenerate';
import GeneratedAssignments from '../pages/Teacher/GeneratedAssignments';
import TeacherStatisticsPage from '../pages/Teacher/TeacherStatistics';
import AssignmentDetails from './Teacher/AssignmentDetailsPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/Registration';
import AvailableAssignments from '../pages/Student/AvailableAssignments';
import SolvedAssignments from '../pages/Student/CompletedAssignments';
import StudentStatistics from '../pages/Student/StudentStatistics';
import AssignmentSubmit from './Student/AssignmentSubmit';
import StudentWelcome from '../pages/Student/StudentWelcome';
import { FaBars, FaTimes } from 'react-icons/fa';
import CompletedDetails from './Student/CompletedDetails';
import TeacherSettings from '../pages/Teacher/TeacherSettings';
import StudentSettings from '../pages/Student/StudentSettings';
import SubjectSelectPage from '../pages/Student/SubjectSelectPage';
import PracticeHub from '../pages/Student/PracticeHub';
import PracticeTest from '../pages/Student/PracticeTest';
import RoadmapView from '../pages/Student/RoadmapView';
import CheckpointPractice from '../pages/Student/CheckpointPractice';
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
                        <Route path="/dolgozat-generalas" element={<AssignmentGeneratePage />} />
                        <Route path="/generalt-dolgozatok" element={<GeneratedAssignments />} />
                        <Route path="/statisztika" element={<TeacherStatisticsPage />} />
                        <Route path="/generalt-dolgozatok/:id" element={<AssignmentDetails />} />
                        <Route path="/tanar-beallitasok" element={<TeacherSettings />} />
                    </>
                )}

                {user?.role === 'student' && (
                    <>
                        <Route path="/elerheto-dolgozatok" element={<AvailableAssignments />} />
                        <Route path="/megoldott-dolgozatok" element={<SolvedAssignments />} />
                        <Route path="/megoldott-dolgozatok/:id" element={<CompletedDetails />} />
                        <Route path="/tanulo-statisztika" element={<StudentStatistics />} />
                        <Route path="/dolgozat/:id" element={<AssignmentSubmit />} />
                        <Route path="/diak-beallitasok" element={<StudentSettings />} />
                        <Route path="/egyeni-gyakorlas" element={<SubjectSelectPage />} />
                        <Route path="/egyeni-gyakorlas/:subject" element={<PracticeHub />} />
                        <Route path="/egyeni-gyakorlas/:subject/teszt" element={<PracticeTest />} />
                        <Route path="/egyeni-gyakorlas/:subject/roadmap" element={<RoadmapView />} />
                        <Route path="/egyeni-gyakorlas/:subject/checkpoint/:checkpointId" element={<CheckpointPractice />} />
                        <Route path="/egyeni-gyakorlas/:subject/eredmeny" element={<DiagnosticResult />} />
                    </>
                )}
            </Routes>
        </>
    );
};

export default Layout;
