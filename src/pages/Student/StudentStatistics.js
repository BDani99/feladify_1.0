import React, { useState, useEffect } from 'react';
import { fetchStudentStatistics } from '../../api/Assignments/Student/Statistics';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import '../../styles/Student/StudentStatistics.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const StudentStatistics = () => {
    const [statistics, setStatistics] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStatistics = async () => {
            try {
                const data = await fetchStudentStatistics();
                setStatistics(data);
                console.log(data)
            } catch (error) {
                setError('A statisztikák betöltése sikertelen');
            } finally {
                setIsLoading(false);
            }
        };

        loadStatistics();
    }, []);

    if (isLoading) {
        return (
            <div id="content">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    const totalPoints = statistics.assignmentsStatistics.reduce(
        (acc, assignment) => acc + assignment.totalPoints,
        0
    );
    const achievedPoints = statistics.assignmentsStatistics.reduce(
        (acc, assignment) => acc + assignment.achievedPoints,
        0
    );

    const barChartData = {
        labels: ['Összes dolgozat'],
        datasets: [
            {
                label: 'Elért pontszámok',
                data: [achievedPoints],
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            },
            {
                label: 'Maximális pontszám',
                data: [totalPoints],
                backgroundColor: '#e74c3c',
                borderColor: '#c0392b',
                borderWidth: 1
            }
        ]
    };

    const pieChartData = {
        labels: ['Teljesített dolgozatok', 'Hiányzó dolgozatok'],
        datasets: [
            {
                data: [
                    statistics.completedAssignmentsCount,
                    statistics.totalAssignmentsCount - statistics.completedAssignmentsCount
                ],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: ['#27ae60', '#c0392b'],
                borderWidth: 1
            }
        ]
    };

    const totalAssignmentsCount = statistics.assignmentsStatistics.length;
    const averageScorePercentage = statistics.averageScorePercentage;

    const donutChartData = {
        labels: ['Átlagos pontszám'],
        datasets: [
            {
                data: [averageScorePercentage, 100 - averageScorePercentage],
                backgroundColor: ['#2ecc71', '#ecf0f1'],
                borderColor: ['#27ae60', '#bdc3c7'],
                borderWidth: 1
            }
        ]
    };

    return (
        <div id="content">
            <div className="student-statistics-container">
                <h1 className="stat-title">Statisztikák</h1>
                <div className='student-statistics'>
                    <div className="statistics-grid">
                        <div className='stats'>
                            <div className="student-statistic-item2">
                                <h2>Dolgozatok száma</h2>
                                <p>Összes dolgozat: {totalAssignmentsCount}</p>
                                <p>Teljesített dolgozatok: {statistics.completedAssignmentsCount}</p>
                            </div>
                            <div className="student-statistic-item2">
                                <h2>Az utolsó dolgozat statisztikái</h2>
                                <div className="last-assignment">
                                    <p><strong>{statistics.assignmentsStatistics[statistics.assignmentsStatistics.length - 1].title}</strong></p>
                                    <p>
                                        Elért pontszám: {statistics.assignmentsStatistics[statistics.assignmentsStatistics.length - 1].achievedPoints}
                                        / {statistics.assignmentsStatistics[statistics.assignmentsStatistics.length - 1].totalPoints}
                                    </p>
                                    <p>
                                        Kitöltés dátuma: {new Date(statistics.assignmentsStatistics[statistics.assignmentsStatistics.length - 1].completedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="student-statistic-item">
                            <h2>Átlagos pontszám</h2>
                            <div className="chart-container donut-chart">
                                <Doughnut data={donutChartData} />
                            </div>
                            <p>{averageScorePercentage.toFixed(2)}%</p>
                        </div>
                    </div>
                    <div className="statistics-grid">
                        <div className="student-statistic-item">
                            <h2>Elért Pontszámok Összesen</h2>
                            <div className="chart-container2">
                                <Bar data={barChartData} />
                            </div>
                        </div>

                        <div className="student-statistic-item">
                            <h2>Dolgozatok Teljesítése</h2>
                            <div className="chart-container">
                                <Pie data={pieChartData} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentStatistics;
