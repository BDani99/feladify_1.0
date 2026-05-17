import React, { useState, useEffect } from 'react';
import { fetchTeacherStatistics } from '../../api/Assignments/Teacher/Statistics';
import { fetchDetailedStatistics } from '../../api/Assignments/Teacher/DetailedStatistics';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { FaExclamationCircle, FaChartBar } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/TeacherStatistics.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const chartOptions = { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#ccc' } } } };

const TeacherStatistics = () => {
    const [statistics, setStatistics] = useState(null);
    const [detailedStats, setDetailedStats] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStatistics = async () => {
            try {
                const [basic, detailed] = await Promise.all([
                    fetchTeacherStatistics(),
                    fetchDetailedStatistics(),
                ]);
                setStatistics(basic);
                setDetailedStats(detailed);
            } catch (err) {
                setError('A statisztikák betöltése nem sikerült. Kérjük, próbáld újra.');
            } finally {
                setIsLoading(false);
            }
        };
        loadStatistics();
    }, []);

    if (isLoading) {
        return (
            <div id="content">
                <div className="statistics-container">
                    <div className="page-header-banner">
                        <div className="phb-icon"><FaChartBar /></div>
                        <div className="phb-text">
                            <h1 className="phb-title">Statisztikák és Elemzések</h1>
                            <p className="phb-subtitle">Tekintsd át a diákok teljesítményét és az osztályok haladását</p>
                        </div>
                    </div>
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    if (error) {
        return <div id="content"><p className="error-message"><FaExclamationCircle />{error}</p></div>;
    }

    const barChartData = {
        labels: ['Összes Dolgozat', 'Teljesített'],
        datasets: [{
            label: 'Dolgozatok',
            data: [statistics.totalAssignments, statistics.completedAssignments],
            backgroundColor: ['#3b82f6', '#8b5cf6'],
            borderWidth: 0,
        }],
    };

    const pieChartData = {
        labels: ['Teljesített', 'Nem teljesített'],
        datasets: [{
            data: [statistics.completionRate, 100 - statistics.completionRate],
            backgroundColor: ['#10b981', '#ef4444'],
            borderWidth: 0,
        }],
    };

    const doughnutChartData = {
        labels: ['Átlag pontszám', 'Hiányzó'],
        datasets: [{
            data: [statistics.avgScorePercentagePerAssignment, 100 - statistics.avgScorePercentagePerAssignment],
            backgroundColor: ['#f39c12', '#555'],
            borderWidth: 0,
        }],
    };

    const hasClassBreakdown = detailedStats?.classBreakdown?.length > 0;
    const hasSubjectBreakdown = detailedStats?.subjectBreakdown?.length > 0;
    const hasLeaderboard = detailedStats?.topStudents?.length > 0 || detailedStats?.bottomStudents?.length > 0;

    return (
        <div id="content">
            <div className="statistics-container">
                <div className="page-header-banner">
                    <div className="phb-icon"><FaChartBar /></div>
                    <div className="phb-text">
                        <h1 className="phb-title">Statisztikák és Elemzések</h1>
                        <p className="phb-subtitle">Tekintsd át a diákok teljesítményét és az osztályok haladását</p>
                    </div>
                </div>
                <div className="stats-content">

                    {/* Összesítő számok */}
                    <div className="stats-summary-row">
                        <div className="stats-metric-card">
                            <div className="metric-value">{statistics.totalAssignments}</div>
                            <div className="metric-label">Összes dolgozat</div>
                        </div>
                        <div className="stats-metric-card">
                            <div className="metric-value">{statistics.completedAssignments}</div>
                            <div className="metric-label">Teljesített</div>
                        </div>
                        <div className="stats-metric-card">
                            <div className="metric-value">{statistics.completionRate}%</div>
                            <div className="metric-label">Teljesítési arány</div>
                        </div>
                        <div className="stats-metric-card">
                            <div className="metric-value">{statistics.avgScorePercentagePerAssignment}%</div>
                            <div className="metric-label">Átlag pontszám</div>
                        </div>
                    </div>

                    {/* Diagramok */}
                    <div className="stats-charts-row">
                        <div className="stats-chart-card">
                            <h2 className="chart-card-title">Dolgozatok áttekintése</h2>
                            <Bar data={barChartData} options={chartOptions} />
                        </div>
                        <div className="stats-chart-card">
                            <h2 className="chart-card-title">Teljesítési arány</h2>
                            <Pie data={pieChartData} options={chartOptions} />
                        </div>
                        <div className="stats-chart-card">
                            <h2 className="chart-card-title">Átlag pontszám %</h2>
                            <Doughnut data={doughnutChartData} options={chartOptions} />
                        </div>
                    </div>

                    {/* Osztály és tantárgy bontás */}
                    {(hasClassBreakdown || hasSubjectBreakdown) && (
                        <div className="stats-tables-row">
                            {hasClassBreakdown && (
                                <div className="stats-table-card">
                                    <h2 className="table-card-title">Osztályonkénti bontás</h2>
                                    <table className="stats-table">
                                        <thead>
                                            <tr>
                                                <th>Osztály</th>
                                                <th>Diákok</th>
                                                <th>Teljesített</th>
                                                <th>Átlag %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailedStats.classBreakdown.map(c => (
                                                <tr key={c.className}>
                                                    <td>{c.className}</td>
                                                    <td>{c.studentCount}</td>
                                                    <td>{c.completedAssignments}</td>
                                                    <td>{c.avgPercentage}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {hasSubjectBreakdown && (
                                <div className="stats-table-card">
                                    <h2 className="table-card-title">Tantárgyankénti bontás</h2>
                                    <table className="stats-table">
                                        <thead>
                                            <tr>
                                                <th>Tantárgy</th>
                                                <th>Összes dolgozat</th>
                                                <th>Teljesítések</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailedStats.subjectBreakdown.map(s => (
                                                <tr key={s.subject}>
                                                    <td>{s.subject}</td>
                                                    <td>{s.totalAssignments}</td>
                                                    <td>{s.completedCount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Toplista */}
                    {hasLeaderboard && (
                        <div className="stats-leaderboard-card">
                            <h2 className="table-card-title">Legjobb és leggyengébb diákok</h2>
                            <div className="leaderboard-columns">
                                <div>
                                    <h3 className="leaderboard-sub-title">🏆 Top 5</h3>
                                    <table className="stats-table">
                                        <thead>
                                            <tr><th>Név</th><th>Osztály</th><th>%</th></tr>
                                        </thead>
                                        <tbody>
                                            {detailedStats.topStudents.map((s, i) => (
                                                <tr key={i}>
                                                    <td>{s.name}</td>
                                                    <td>{s.className}</td>
                                                    <td className="score-good">{s.percentage}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div>
                                    <h3 className="leaderboard-sub-title">📉 Leggyengébb 5</h3>
                                    <table className="stats-table">
                                        <thead>
                                            <tr><th>Név</th><th>Osztály</th><th>%</th></tr>
                                        </thead>
                                        <tbody>
                                            {detailedStats.bottomStudents.map((s, i) => (
                                                <tr key={i}>
                                                    <td>{s.name}</td>
                                                    <td>{s.className}</td>
                                                    <td className="score-bad">{s.percentage}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default TeacherStatistics;
