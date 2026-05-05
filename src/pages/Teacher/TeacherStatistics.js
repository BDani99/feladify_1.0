import React, { useState, useEffect } from 'react';
import { fetchTeacherStatistics } from '../../api/Assignments/Teacher/Statistics';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/Teacher/TeacherStatistics.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const TeacherStatistics = () => {
    const [statistics, setStatistics] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadStatistics = async () => {
            try {
                const data = await fetchTeacherStatistics();
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

    const barChartData = {
        labels: ['Összes Feladat', 'Teljesített Feladatok'],
        datasets: [
            {
                label: 'Feladatok',
                data: [statistics.totalAssignments, statistics.completedAssignments],
                backgroundColor: ['#3498db', '#8e44ad'],
                borderColor: '#333',
                borderWidth: 1,
            },
        ],
    };

    const pieChartData = {
        labels: ['Befejezett', 'Folyamatban'],
        datasets: [
            {
                data: [statistics.completionRate, 100 - statistics.completionRate],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderColor: '#fff',
                borderWidth: 1,
            },
        ],
    };

    const doughnutChartData = {
        labels: ['Átlagos Pontszám', 'Folyamatban'],
        datasets: [
            {
                data: [statistics.avgScorePercentagePerAssignment, 100 - statistics.avgScorePercentagePerAssignment],
                backgroundColor: ['#f39c12', '#e74c3c'],
                borderColor: '#fff',
                borderWidth: 1,
            },
        ],
    };

    return (
        <div id="content">
            <div className="statistics-container">
                <h1 className="stat-title">Statisztikák</h1>
                <div className="statistics">
                    <div className="statistic-item">
                        <h2>Összes és Befejezett Feladatok</h2>
                        <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: true }} />
                    </div>

                    <div className="statistic-item">
                        <h2>Befejezett Feladatok Aránya</h2>
                        <Pie data={pieChartData} options={{ responsive: true, maintainAspectRatio: true }} />
                    </div>

                    <div className="statistic-item">
                        <h2>Átlagos Pontszám Százalék</h2>
                        <Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: true }} />
                        <p>{statistics.avgScorePercentagePerAssignment}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherStatistics;
