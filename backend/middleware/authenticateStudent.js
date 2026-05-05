const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateStudent = async (req, res, next) => {
  try {
    // Ellenőrizzük, hogy van-e token a fejlécekben
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Hozzáférés megtagadva. Bejelentkezés szükséges.' });
    }

    // Token ellenőrzése
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    // Ellenőrizzük, hogy a felhasználó diák-e
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'Hozzáférés megtagadva. Csak diákok számára elérhető.' });
    }

    // Felhasználó adatok hozzáadása a kéréshez, hogy később is hozzáférjünk
    req.userId = user._id;
    req.userRole = user.role;
    next();
  } catch (error) {
    console.error('Hiba az autentikáció során:', error);
    res.status(401).json({ message: 'Érvénytelen token.' });
  }
};

module.exports = authenticateStudent;
