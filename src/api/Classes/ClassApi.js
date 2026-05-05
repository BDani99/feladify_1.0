const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
});

export const fetchAllClasses = async () => {
  const response = await fetch('/api/classes', {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Hiba az osztályok lekérésekor.');
  return data.classes;
};

export const createClass = async (name) => {
  const response = await fetch('/api/classes', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Hiba az osztály létrehozásakor.');
  return data;
};

export const updateTeacherClasses = async (classIds) => {
  const response = await fetch('/api/teacher/update-classes', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ classIds }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Hiba az osztályok frissítésekor.');
  return data;
};
