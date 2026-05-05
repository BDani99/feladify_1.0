export const fetchStudentStatistics = async () => {
    try {
      const response = await fetch('/api/assignments/student/statistics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('AccessToken')}`,
        },
      });
  
      if (!response.ok) {
        throw new Error('Hiba történt a statisztikák lekérése során.');
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(error.message);
    }
  };
  