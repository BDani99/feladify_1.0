import { toast } from 'react-toastify';

const defaultOptions = {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export const showSuccess = (message, options = {}) =>
  toast.success(message, { ...defaultOptions, ...options });

export const showError = (message, options = {}) =>
  toast.error(message, { ...defaultOptions, autoClose: 6000, ...options });

export const showWarning = (message, options = {}) =>
  toast.warning(message, { ...defaultOptions, ...options });

export const showInfo = (message, options = {}) =>
  toast.info(message, { ...defaultOptions, ...options });

export const showSessionExpired = () =>
  toast.error('A munkamenet lejárt. Kérjük, jelentkezzen be újra.', {
    ...defaultOptions,
    autoClose: 5000,
    toastId: 'session-expired',
  });
