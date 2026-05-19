const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// GET /api/curriculum/topics
router.get('/topics', (req, res) => {
  try {
    const { subject, grade } = req.query;

    if (!subject || !grade) {
      return res.status(400).json({ message: 'A tantárgy és évfolyam paraméter megadása kötelező.' });
    }

    // Normalizáljuk a tárgy nevét
    const normSubject = subject.trim().toLowerCase();

    // Kivonjuk a számot az évfolyamból (pl. "5. osztály" vagy "5.A" vagy "5" -> 5)
    const gradeMatch = String(grade).match(/^(\d+)/);
    const gradeNum = gradeMatch ? parseInt(gradeMatch[1], 10) : null;

    let fileName = null;
    let minGrade = 5;
    let maxGrade = 8;

    if (normSubject === 'matematika') {
      fileName = 'curriculum_matematika.json';
    } else if (normSubject === 'nyelvtan') {
      fileName = 'curriculum_nyelvtan.json';
    } else if (normSubject === 'irodalom') {
      fileName = 'curriculum_irodalom.json';
    } else if (normSubject === 'történelem' || normSubject === 'tortenelem') {
      fileName = 'curriculum_tortenelem.json';
    } else if (
      normSubject === 'környezetismeret' ||
      normSubject === 'kornyezet' ||
      normSubject === 'természetismeret' ||
      normSubject === 'természettudomány'
    ) {
      fileName = 'curriculum_kornyezet.json';
      maxGrade = 6; // Környezetismeret csak 5-6. osztályban elérhető
    } else if (normSubject === 'fizika') {
      fileName = 'curriculum_fizika.json';
      minGrade = 7; maxGrade = 8;
    } else if (normSubject === 'biológia' || normSubject === 'biologia') {
      fileName = 'curriculum_biologia.json';
      minGrade = 7; maxGrade = 8;
    } else if (normSubject === 'földrajz' || normSubject === 'foldrajz') {
      fileName = 'curriculum_foldrajz.json';
      minGrade = 7; maxGrade = 8;
    }

    if (fileName && gradeNum >= minGrade && gradeNum <= maxGrade) {
      const curriculumPath = path.join(__dirname, '../data', fileName);
      if (fs.existsSync(curriculumPath)) {
        const fileContent = fs.readFileSync(curriculumPath, 'utf8');
        const curriculum = JSON.parse(fileContent);
        
        const key = (gradeNum === 5 || gradeNum === 6) ? '5-6' : '7-8';
        const topics = curriculum[key] || [];
        
        return res.json({
          available: true,
          subject,
          grade: gradeNum,
          topics: topics.map(t => ({ id: t.id, name: t.name, recommendedHours: t.recommendedHours }))
        });
      }
    }

    // Ha nem támogatott tantárgy vagy évfolyam
    return res.json({
      available: false,
      message: 'Ehhez a tantárgyhoz és évfolyamhoz jelenleg nem áll rendelkezésre a részletes nemzeti kerettanterv.'
    });

  } catch (error) {
    console.error('[Curriculum API] Error:', error);
    res.status(500).json({ message: 'Belső hiba a tanterv lekérdezésekor.', error: error.message });
  }
});

module.exports = router;
