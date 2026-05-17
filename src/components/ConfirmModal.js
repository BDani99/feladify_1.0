import React from 'react';
import { FaExclamationTriangle, FaTrashAlt, FaInfoCircle } from 'react-icons/fa';
import '../styles/ConfirmModal.css';

/**
 * Reusable premium glassmorphic confirmation modal
 * @param {boolean} isOpen - Controls visibility
 * @param {string} title - Modal title (default: "Megerősítés")
 * @param {string} message - Descriptive prompt message
 * @param {function} onConfirm - Success callback
 * @param {function} onCancel - Cancel callback
 * @param {string} confirmText - Label for confirm button (default: "Törlés" / "Igen")
 * @param {string} cancelText - Label for cancel button (default: "Mégse")
 * @param {string} type - Modal type theme: 'danger' | 'info' | 'warning' (default: 'danger')
 */
const ConfirmModal = ({
  isOpen,
  title = 'Megerősítés',
  message,
  onConfirm,
  onCancel,
  confirmText = 'Igen, biztosan',
  cancelText = 'Mégse',
  type = 'danger'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <FaExclamationTriangle className="confirm-icon warning-theme" />;
      case 'info':
        return <FaInfoCircle className="confirm-icon info-theme" />;
      default:
        return <FaTrashAlt className="confirm-icon danger-theme" />;
    }
  };

  return (
    <div className="confirm-modal-overlay">
      <div className={`confirm-modal-card animate-scale-in confirm-theme-${type}`}>
        <div className="confirm-modal-header">
          <div className="confirm-icon-wrapper">
            {getIcon()}
          </div>
          <h3>{title}</h3>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`confirm-btn confirm-btn-action theme-${type}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
