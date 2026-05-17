const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/errorResponse');

const authenticateUser = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return sendError(res, 401, 'Nincs token. Hozzáférés megtagadva.', 'NO_TOKEN');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'A munkamenet lejárt. Kérjük, jelentkezzen be újra.', 'TOKEN_EXPIRED');
    }
    return sendError(res, 401, 'Érvénytelen token.', 'TOKEN_INVALID');
  }
};

module.exports = authenticateUser;
