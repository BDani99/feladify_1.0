import { showError, showSessionExpired } from './toast';

export const handleSessionExpiry = () => {
  localStorage.removeItem('AccessToken');
  localStorage.removeItem('isLoggedIn');
  showSessionExpired();
  setTimeout(() => {
    window.location.href = '/bejelentkezes';
  }, 1500);
};

export const handleApiError = async (response) => {
  let errorData = {};
  try {
    errorData = await response.json();
  } catch {
    // válasz nem JSON
  }

  const code = errorData.code;
  const message = errorData.message || 'Ismeretlen hiba történt.';

  if (response.status === 401) {
    handleSessionExpiry();
    throw new Error('SESSION_EXPIRED');
  }

  if (response.status === 403) {
    showError('Hozzáférés megtagadva.');
    throw new Error(message);
  }

  if (response.status >= 500) {
    showError('Szerverhiba történt. Kérjük, próbálja újra később.');
    throw new Error(message);
  }

  throw new Error(message);
};
