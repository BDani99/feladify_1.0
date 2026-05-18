import React, { useState, useEffect, useRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';

const ParentChildSelector = ({ childrenList, selectedId, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedChild = childrenList.find(c => c._id === selectedId);

    return (
        <div className="glass-card parent-child-selector" style={{ marginLeft: 'auto' }}>
            <label>Gyermek:</label>
            <div ref={containerRef} style={{ position: 'relative', minWidth: 160 }}>
                <div
                    className={`custom-select-trigger has-value${isOpen ? ' open' : ''}`}
                    style={{ height: 36, padding: '0 12px', fontSize: '0.9rem' }}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="trigger-content">
                        <span style={{ fontWeight: 700 }}>
                            {selectedChild ? selectedChild.name : 'Válassz...'}
                        </span>
                    </div>
                    <FaChevronDown className="select-chevron" />
                </div>
                {isOpen && (
                    <div className="custom-select-options" style={{ minWidth: '100%', width: 'max-content', maxWidth: 280 }}>
                        {childrenList.map(c => (
                            <div
                                key={c._id}
                                className={`custom-select-option${c._id === selectedId ? ' selected' : ''}`}
                                style={{ whiteSpace: 'nowrap' }}
                                onClick={() => {
                                    onChange(c._id);
                                    setIsOpen(false);
                                }}
                            >
                                {c.name}{c.className ? ` (${c.className})` : ''}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ParentChildSelector;
