const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
});

export const fetchAllClasses = async () => {
  const response = await fetch('/api/classes', {
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
  const response = await fetch('/api/classes', {
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
  const response = await fetch('/api/teacher/update-classes', {
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
