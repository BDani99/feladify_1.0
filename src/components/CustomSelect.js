import React, { useState, useEffect, useRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';

/**
 * A premium, custom dropdown selection component.
 * Supports both string arrays: ['A', 'B']
 * and object arrays for value/label mapping: [{ value: 'all', label: 'All Subjects' }]
 */
const CustomSelect = ({ value, onChange, options = [], placeholder = 'Válassz...', icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to extract option value and display label
    const getOptionDetails = (opt) => {
        if (typeof opt === 'object' && opt !== null) {
            return { val: opt.value, label: opt.label };
        }
        return { val: opt, label: opt };
    };

    // Find currently selected option's label to show in the dropdown trigger
    const getSelectedLabel = () => {
        if (value === undefined || value === null || value === '') return '';
        const found = options.find(opt => {
            const { val } = getOptionDetails(opt);
            return val === value;
        });
        if (found) {
            return getOptionDetails(found).label;
        }
        return value;
    };

    return (
        <div className="custom-select-container" ref={containerRef}>
            <div 
                className={`custom-select-trigger ${isOpen ? 'open' : ''} ${value ? 'has-value' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="trigger-content">
                    {icon && <span className="select-icon">{icon}</span>}
                    <span>{getSelectedLabel() || placeholder}</span>
                </div>
                <FaChevronDown className="select-chevron" />
            </div>
            
            {isOpen && (
                <div className="custom-select-options">
                    {options.map((opt, index) => {
                        const { val, label } = getOptionDetails(opt);
                        const isSelected = value === val;
                        return (
                            <div 
                                key={index} 
                                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                    onChange(val);
                                    setIsOpen(false);
                                }}
                            >
                                {label}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
