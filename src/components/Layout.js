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
import TeacherDashboard from '../pages/Teacher/TeacherDashboard';
import CurriculumConfig from '../pages/Teacher/CurriculumConfig';
import StudentDashboard from '../pages/Student/StudentDashboard';
import StudentGoals from '../pages/Student/StudentGoals';
import DocumentsPage from '../pages/Documents';
import AnnouncementsPage from '../pages/Announcements';
import ParentDashboard from '../pages/Parent/ParentDashboard';
import ParentGoals from '../pages/Parent/ParentGoals';
import ParentResults from '../pages/Parent/ParentResults';
import ParentRoadmap from '../pages/Parent/ParentRoadmap';
import ParentAIConsultant from '../pages/Parent/ParentAIConsultant';
import ParentSettings from '../pages/Parent/ParentSettings';
import ParentAnnouncements from '../pages/Parent/ParentAnnouncements';
import ParentStatistics from '../pages/Parent/ParentStatistics';

const Layout = ({ onLoginSuccess }) => {
    const { user } = useUser() || {};
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

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
                <Route path="/" element={
                    user?.role === 'teacher' 
                        ? <Navigate to="/iranyitopult" />
                        : (user?.role === 'parent' ? <Navigate to="/szulo-iranyitopult" /> : <Navigate to="/iranyitopult" />)
                } />
                <Route path="/bejelentkezes" element={<Navigate to="/" />} />
                <Route path="/regisztracio" element={<Navigate to="/" />} />

                {user?.role === 'teacher' && (
                    <>
                        <Route path="/ai-asszisztens" element={<WelcomePage />} />
                        <Route path="/iranyitopult" element={<TeacherDashboard />} />
                        <Route path="/kerettanterv" element={<CurriculumConfig />} />
                        <Route path="/dolgozat-generalas" element={<AssignmentGeneratePage />} />
                        <Route path="/generalt-dolgozatok" element={<GeneratedAssignments />} />
                        <Route path="/statisztika" element={<TeacherStatisticsPage />} />
                        <Route path="/generalt-dolgozatok/:id" element={<AssignmentDetails />} />
                        <Route path="/tanar-beallitasok" element={<TeacherSettings />} />
                        <Route path="/dokumentumok" element={<DocumentsPage />} />
                        <Route path="/osztalyterem" element={<AnnouncementsPage />} />
                    </>
                )}

                {user?.role === 'student' && (
                    <>
                        <Route path="/ai-tanar" element={<StudentWelcome />} />
                        <Route path="/iranyitopult" element={<StudentDashboard />} />
                        <Route path="/szulo-celok" element={<StudentGoals />} />
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
                        <Route path="/dokumentumok" element={<DocumentsPage />} />
                        <Route path="/osztalyterem" element={<AnnouncementsPage />} />
                    </>
                )}

                {user?.role === 'parent' && (
                    <>
                        <Route path="/szulo-iranyitopult" element={<ParentDashboard />} />
                        <Route path="/szulo-celok" element={<ParentGoals />} />
                        <Route path="/szulo-eredmenyek" element={<ParentResults />} />
                        <Route path="/szulo-eredmenyek/:id" element={<CompletedDetails />} />
                        <Route path="/szulo-roadmap" element={<ParentRoadmap />} />
                        <Route path="/szulo-statisztika" element={<ParentStatistics />} />
                        <Route path="/szulo-ai-tanacsado" element={<ParentAIConsultant />} />
                        <Route path="/szulo-beallitasok" element={<ParentSettings />} />
                        <Route path="/szulo-osztalyterem" element={<ParentAnnouncements />} />
                    </>
                )}
            </Routes>
        </>
    );
};

export default Layout;
