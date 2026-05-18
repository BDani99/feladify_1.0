import React, { useState, useEffect, useRef } from 'react';
import { FaChevronLeft, FaChevronRight, FaChevronDown, FaCalendarAlt } from 'react-icons/fa';

const HUNGARIAN_MONTHS = [
    'január', 'február', 'március', 'április', 'május', 'június',
    'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
];
const WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

/**
 * A premium, custom calendar picker component.
 * Supports date selection: type="date" (returns YYYY-MM-DD, closes on click)
 * and date-time selection: type="datetime" (returns YYYY-MM-DDTHH:MM with time columns)
 */
const CustomDatePicker = ({ value, onChange, type = 'date', placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const containerRef = useRef(null);

    const isDateTime = type === 'datetime';

    // Parse current value
    const dateObj = value ? new Date(value) : null;
    const selectedDate = dateObj;
    const selectedHour = dateObj && !isNaN(dateObj.getTime()) ? dateObj.getHours() : 12;
    const selectedMinute = dateObj && !isNaN(dateObj.getTime()) ? dateObj.getMinutes() : 0;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Format display date
    const getDisplayText = () => {
        if (!dateObj || isNaN(dateObj.getTime())) {
            return placeholder || (isDateTime ? 'Nincs határidő megadva' : 'éééé. hh. nn.');
        }
        const year = dateObj.getFullYear();
        const monthName = HUNGARIAN_MONTHS[dateObj.getMonth()];
        const day = dateObj.getDate();
        if (isDateTime) {
            const hour = String(dateObj.getHours()).padStart(2, '0');
            const minute = String(dateObj.getMinutes()).padStart(2, '0');
            return `${year}. ${monthName} ${day}. ${hour}:${minute}`;
        }
        return `${year}. ${monthName} ${day}.`;
    };

    const handleMonthChange = (direction) => {
        setCurrentMonth(prev => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + direction);
            return next;
        });
    };

    const pad = (num) => String(num).padStart(2, '0');

    const formatOutput = (date, hour, minute) => {
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        if (isDateTime) {
            return `${year}-${month}-${day}T${pad(hour)}:${pad(minute)}`;
        }
        return `${year}-${month}-${day}`;
    };

    const handleSelectDay = (dayObj) => {
        if (isPastDate(dayObj.year, dayObj.month, dayObj.day)) return;
        const newDate = new Date(dayObj.year, dayObj.month, dayObj.day);
        const formatted = formatOutput(newDate, selectedHour, selectedMinute);
        onChange(formatted);
        if (!isDateTime) {
            setIsOpen(false); // Close dropdown immediately in date-only mode
        }
    };

    const handleSelectHour = (hour) => {
        const baseDate = selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate : new Date();
        const formatted = formatOutput(baseDate, hour, selectedMinute);
        onChange(formatted);
    };

    const handleSelectMinute = (minute) => {
        const baseDate = selectedDate && !isNaN(selectedDate.getTime()) ? selectedDate : new Date();
        const formatted = formatOutput(baseDate, selectedHour, minute);
        onChange(formatted);
    };

    const handleToday = () => {
        const today = new Date();
        const formatted = formatOutput(today, today.getHours(), today.getMinutes());
        onChange(formatted);
        setCurrentMonth(today);
        if (!isDateTime) {
            setIsOpen(false);
        }
    };

    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    const isPastDate = (y, m, d) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateToCheck = new Date(y, m, d);
        return dateToCheck < today;
    };

    const isSameDay = (d1, y, m, d) => {
        if (!d1 || isNaN(d1.getTime())) return false;
        return d1.getFullYear() === y && d1.getMonth() === m && d1.getDate() === d;
    };

    // Calculate calendar grid
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1, ...
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const prevMonthDays = new Date(year, month, 0).getDate();
    const days = [];

    // Prev month days
    for (let i = startOffset - 1; i >= 0; i--) {
        days.push({
            day: prevMonthDays - i,
            month: month === 0 ? 11 : month - 1,
            year: month === 0 ? year - 1 : year,
            isCurrentMonth: false
        });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            day: i,
            month: month,
            year: year,
            isCurrentMonth: true
        });
    }

    // Next month filler
    const totalSlots = days.length <= 35 ? 35 : 42;
    const nextMonthFiller = totalSlots - days.length;
    for (let i = 1; i <= nextMonthFiller; i++) {
        days.push({
            day: i,
            month: month === 11 ? 0 : month + 1,
            year: month === 11 ? year + 1 : year,
            isCurrentMonth: false
        });
    }

    const hoursArray = Array.from({ length: 24 }, (_, i) => i);
    const minutesArray = Array.from({ length: 60 }, (_, i) => i);

    return (
        <div className="custom-datetime-container" ref={containerRef}>
            <div 
                className={`custom-datetime-trigger ${isOpen ? 'open' : ''} ${value ? 'has-value' : ''}`}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && dateObj && !isNaN(dateObj.getTime())) {
                        setCurrentMonth(dateObj);
                    }
                }}
            >
                <div className="trigger-content">
                    <FaCalendarAlt className="datetime-icon" />
                    <span>{getDisplayText()}</span>
                </div>
                <FaChevronDown className="datetime-chevron" />
            </div>

            {isOpen && (
                <div className={`custom-datetime-dropdown ${!isDateTime ? 'date-only' : ''}`}>
                    <div className="picker-split-layout">
                        {/* LEFT: Calendar */}
                        <div className="picker-left-calendar">
                            <div className="calendar-header">
                                <button type="button" className="cal-nav-btn" onClick={() => handleMonthChange(-1)}>
                                    <FaChevronLeft />
                                </button>
                                <span className="calendar-current-month">
                                    {year}. {HUNGARIAN_MONTHS[month]}
                                </span>
                                <button type="button" className="cal-nav-btn" onClick={() => handleMonthChange(1)}>
                                    <FaChevronRight />
                                </button>
                            </div>

                            <div className="calendar-weekdays">
                                {WEEKDAYS.map(d => <span key={d} className="weekday-label">{d}</span>)}
                            </div>

                            <div className="calendar-grid">
                                {days.map((dayObj, idx) => {
                                    const isSelected = isSameDay(selectedDate, dayObj.year, dayObj.month, dayObj.day);
                                    const isPast = isPastDate(dayObj.year, dayObj.month, dayObj.day);
                                    
                                    return (
                                        <button
                                            type="button"
                                            key={idx}
                                            disabled={isPast}
                                            className={`calendar-day-btn ${dayObj.isCurrentMonth ? 'current-month' : 'other-month'} ${isSelected ? 'selected' : ''}`}
                                            onClick={() => handleSelectDay(dayObj)}
                                        >
                                            {dayObj.day}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="calendar-footer">
                                <button type="button" className="footer-action-btn today" onClick={handleToday}>
                                    Ma
                                </button>
                                <button type="button" className="footer-action-btn clear" onClick={handleClear}>
                                    Törlés
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: Time Selector */}
                        {isDateTime && (
                            <>
                                <div className="picker-right-time">
                                    <div className="time-column-title">Óra</div>
                                    <div className="time-scroll-list">
                                        {hoursArray.map(h => (
                                            <div 
                                                key={h}
                                                className={`time-scroll-item ${selectedHour === h ? 'selected' : ''}`}
                                                onClick={() => handleSelectHour(h)}
                                            >
                                                {pad(h)}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="picker-right-time">
                                    <div className="time-column-title">Perc</div>
                                    <div className="time-scroll-list">
                                        {minutesArray.map(m => (
                                            <div 
                                                key={m}
                                                className={`time-scroll-item ${selectedMinute === m ? 'selected' : ''}`}
                                                onClick={() => handleSelectMinute(m)}
                                            >
                                                {pad(m)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomDatePicker;
