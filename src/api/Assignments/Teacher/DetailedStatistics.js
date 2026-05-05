export const fetchDetailedStatistics = async () => {
  const response = await fetch('/api/assignments/teacher/detailed-statistics', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Hiba a részletes statisztikák lekérésekor.');
  return data;
};
