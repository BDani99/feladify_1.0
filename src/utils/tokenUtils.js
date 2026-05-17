const decodeToken = (token) => {
  try {
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  return Date.now() / 1000 > payload.exp - 10;
};

export const getValidToken = () => {
  const token = localStorage.getItem('AccessToken');
  if (!token || isTokenExpired(token)) return null;
  return token;
};
