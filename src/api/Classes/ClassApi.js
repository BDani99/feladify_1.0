import { API_BASE_URL } from '../config';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
});

export const fetchAllClasses = async () => {
  const response = await fetch(`${API_BASE_URL}/classes`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Hiba az osztályok lekérésekor.');
  }
  const data = await response.json();
  return data.classes;
};

export const createClass = async (name) => {
  const response = await fetch(`${API_BASE_URL}/classes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Hiba az osztály létrehozásakor.');
  }
  const data = await response.json();
  return data;
};

export const updateTeacherClasses = async (classIds) => {
  const response = await fetch(`${API_BASE_URL}/teacher/update-classes`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ classIds }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Hiba az osztályok frissítésekor.');
  }
  const data = await response.json();
  return data;
};
