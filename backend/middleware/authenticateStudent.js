const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/errorResponse');

const authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return sendError(res, 401, 'Hozzáférés megtagadva. Bejelentkezés szükséges.', 'NO_TOKEN');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return sendError(res, 401, 'A munkamenet lejárt. Kérjük, jelentkezzen be újra.', 'TOKEN_EXPIRED');
      }
      return sendError(res, 401, 'Érvénytelen token.', 'TOKEN_INVALID');
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.role !== 'student') {
      return sendError(res, 403, 'Hozzáférés megtagadva. Csak diákok számára elérhető.', 'FORBIDDEN');
    }

    req.userId = user._id;
    req.userRole = user.role;
    next();
  } catch (error) {
    console.error('Hiba az autentikáció során:', error);
    return sendError(res, 500, 'Belső hiba az autentikáció során.', 'SERVER_ERROR');
  }
};

module.exports = authenticateStudent;
