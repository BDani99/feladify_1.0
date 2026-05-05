const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Class = require('../models/Class');
const Assignment = require('../models/Assignment');
const router = express.Router();
const authenticateUser = require('../middleware/authenticateUser');

// Regisztráció végpont
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, subject, className } = req.body;

    // Ellenőrzi, hogy az email cím már használatban van-e
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Ez az e-mail cím már használatban van.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Új felhasználó létrehozása
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      subject: role === 'teacher' ? subject : null,
      className: role === 'student' ? className : null,
      createdAt: new Date()
    });

    await user.save();

    // A diákok esetén frissítjük az osztály `studentIds` mezőjét és hozzáadjuk az osztály dolgozataihoz
    if (role === 'student' && className) {
      const classDoc = await Class.findOne({ name: className });

      if (classDoc) {
        // Diák hozzáadása az osztályhoz
        classDoc.studentIds.push(user._id);
        await classDoc.save();

        // Diák hozzáadása az osztály dolgozataihoz
        await Assignment.updateMany(
          { className: className }, // Csak az adott osztályhoz tartozó dolgozatok
          { $addToSet: { studentIds: user._id } } // Hozzáadja a diák ID-ját, ha még nincs benne
        );
      } else {
        return res.status(400).json({ message: 'Az adott osztály nem található.' });
      }
    }

    res.status(201).json({ message: 'Felhasználó sikeresen regisztrálva.' });
  } catch (error) {
    console.error(error);

    // Ha `ValidationError` történt, összegyűjti a hiányzó mezőket
    if (error.name === 'ValidationError') {
      const missingFields = Object.keys(error.errors);
      const message = `A következő mezők megadása kötelező: ${missingFields.join(', ')}.`;
      return res.status(400).json({ message });
    }

    res.status(500).json({ message: 'Hiba történt a regisztráció során.' });
  }
});

// Bejelentkezés végpont
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Felhasználó keresése az adatbázisban
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Helytelen e-mail cím vagy jelszó.' });
    }

    // Jelszó ellenőrzése
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Helytelen e-mail cím vagy jelszó.' });
    }

    // JWT token generálása
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token, message: 'Sikeres bejelentkezés.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a bejelentkezés során.' });
  }
});

// Kijelentkezés végpont
router.post('/logout', (req, res) => {
  res.json({ message: 'Sikeres kijelentkezés.' });
});

// Saját profil adatainak lekérdezése
router.get('/data', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId; // A felhasználó azonosítója a tokenből

    // A felhasználó adatainak lekérdezése
    const user = await User.findById(userId).select('-password'); // Jelszó kihagyása a válaszból
    if (!user) {
      return res.status(404).json({ message: 'Felhasználó nem található.' });
    }

    res.status(200).json({ message: 'Felhasználó adatai sikeresen lekérve', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a felhasználói adatok lekérdezése során.' });
  }
});

// E-mail cím módosítása
router.put('/update-email', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId; // Felhasználó azonosítója a tokenből
    const { newEmail } = req.body;

    // Ellenőrzi, hogy meg van-e adva az új e-mail cím
    if (!newEmail || typeof newEmail !== 'string' || newEmail.trim() === '') {
      return res.status(400).json({ message: 'Az új e-mail cím megadása kötelező.' });
    }

    // Ellenőrzi, hogy az új e-mail cím nincs-e használatban
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Ez az e-mail cím már használatban van.' });
    }

    // Frissíti a felhasználó e-mail címét
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email: newEmail },
      { new: true } // Az új dokumentumot adja vissza
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Felhasználó nem található.' });
    }

    res.status(200).json({ message: 'E-mail cím sikeresen módosítva.', updatedEmail: updatedUser.email });
  } catch (error) {
    console.error('Hiba történt az e-mail cím módosítása során:', error);
    res.status(500).json({ message: 'Hiba történt az e-mail cím módosítása során.' });
  }
});

// Jelszó módosítása
router.put('/update-password', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId; // A felhasználó azonosítója a tokenből
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Ellenőrizzük, hogy az összes szükséges adat meg lett-e adva
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: 'Kérjük, adja meg a jelenlegi jelszót, valamint az új jelszót kétszer.' });
    }

    // Ellenőrizzük, hogy az új jelszó és a megerősített jelszó egyeznek-e
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Az új jelszavak nem egyeznek.' });
    }

    // Felhasználó lekérdezése
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Felhasználó nem található.' });
    }

    // Ellenőrizzük, hogy a jelenlegi jelszó helyes-e
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Helytelen jelenlegi jelszó.' });
    }

    // Ellenőrizzük az új jelszó erősségét (pl. minimum hosszúság)
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Az új jelszónak legalább 8 karakter hosszúnak kell lennie.' });
    }

    // Új jelszó hash-elése
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Jelszó frissítése az adatbázisban
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'A jelszó sikeresen módosítva.' });
  } catch (error) {
    console.error('Hiba történt a jelszó módosítása során:', error);
    res.status(500).json({ message: 'Hiba történt a jelszó módosítása során.' });
  }
});

module.exports = router;
