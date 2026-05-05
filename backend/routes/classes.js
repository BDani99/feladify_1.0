const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const authenticateTeacher = require('../middleware/authenticateTeacher'); // Feltételezve, hogy van egy ilyen middleware az autentikációhoz

// Tanárhoz tartozó osztályok lekérése diákokkal együtt
router.get('/teacher/classes', authenticateTeacher, async (req, res) => {
  try {
    // Tanár azonosítója az autentikáció alapján
    const teacherId = req.userId;

    // Osztályok keresése, ahol a tanár szerepel a teacherIds mezőben, és diákok betöltése a studentIds mezőben
    const classes = await Class.find({ teacherIds: teacherId }).populate('studentIds', 'name email');

    res.status(200).json({ classes });
  } catch (error) {
    console.error('Hiba történt az osztályok lekérése során:', error);
    res.status(500).json({ message: 'Hiba történt az osztályok lekérése során.' });
  }
});

// Az összes osztály lekérése a regisztrációhoz
router.get('/classes', async (req, res) => {
  try {
    const classes = await Class.find().select('name'); // Csak az osztályok neveit kérdezzük le
    res.status(200).json({ classes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt az osztályok lekérdezése során.' });
  }
});

module.exports = router;
