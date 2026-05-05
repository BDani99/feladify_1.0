const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const authenticateTeacher = require('../middleware/authenticateTeacher');

// Tanárhoz tartozó osztályok lekérése diákokkal együtt
router.get('/teacher/classes', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    const classes = await Class.find({ teacherIds: teacherId }).populate('studentIds', 'name email');
    res.status(200).json({ classes });
  } catch (error) {
    console.error('Hiba történt az osztályok lekérése során:', error);
    res.status(500).json({ message: 'Hiba történt az osztályok lekérése során.' });
  }
});

// Az összes osztály lekérése (regisztrációhoz és beállításokhoz)
router.get('/classes', async (req, res) => {
  try {
    const classes = await Class.find().select('name');
    res.status(200).json({ classes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt az osztályok lekérdezése során.' });
  }
});

// Új osztály létrehozása (csak tanár)
router.post('/classes', authenticateTeacher, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Az osztály nevének megadása kötelező.' });
    }
    const existing = await Class.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Ez az osztálynév már foglalt.' });
    }
    const newClass = new Class({ name: name.trim(), teacherIds: [req.userId], studentIds: [] });
    await newClass.save();
    res.status(201).json({ message: 'Osztály sikeresen létrehozva.', class: newClass });
  } catch (error) {
    console.error('Hiba az osztály létrehozása során:', error);
    res.status(500).json({ message: 'Hiba történt az osztály létrehozása során.' });
  }
});

// Tanár osztály-hozzárendeléseinek frissítése
router.put('/teacher/update-classes', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    const { classIds } = req.body;

    if (!Array.isArray(classIds)) {
      return res.status(400).json({ message: 'classIds tömbnek kell lennie.' });
    }

    // Eltávolítja a tanárt minden osztályból
    await Class.updateMany({}, { $pull: { teacherIds: teacherId } });

    // Hozzáadja a tanárt a kijelölt osztályokhoz
    if (classIds.length > 0) {
      await Class.updateMany(
        { _id: { $in: classIds } },
        { $addToSet: { teacherIds: teacherId } }
      );
    }

    const updatedClasses = await Class.find({ teacherIds: teacherId }).populate('studentIds', 'name email');
    res.status(200).json({ message: 'Osztályok sikeresen frissítve.', classes: updatedClasses });
  } catch (error) {
    console.error('Hiba az osztályok frissítése során:', error);
    res.status(500).json({ message: 'Hiba történt az osztályok frissítése során.' });
  }
});

module.exports = router;
