export const fetchAvaiableAssignments = async () => {
  try {
    const response = await fetch('/api/assignments/student/available-assignments', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Hiba történt a dolgozatok lekérésekor');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export const fetchCompletedAssignments = async () => {
  try {
    const response = await fetch('/api/assignments/student/completed-assignments', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.assignments;
  } catch (error) {
    console.error('Error fetching completed assignments:', error);
    throw error;
  }
}
