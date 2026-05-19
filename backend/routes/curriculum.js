const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const TeacherCurriculum = require('../models/TeacherCurriculum');
const authenticateTeacher = require('../middleware/authenticateTeacher');

// Helper function to normalise subject and load default JSON curriculum
function getDefaultCurriculum(normSubject, gradeNum) {
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
  } else if (normSubject === 'angol') {
    fileName = 'curriculum_angol.json';
    minGrade = 5; maxGrade = 8;
  } else if (normSubject === 'német' || normSubject === 'nemet') {
    fileName = 'curriculum_nemet.json';
    minGrade = 5; maxGrade = 8;
  }

  if (fileName && gradeNum >= minGrade && gradeNum <= maxGrade) {
    const curriculumPath = path.join(__dirname, '../data', fileName);
    if (fs.existsSync(curriculumPath)) {
      const fileContent = fs.readFileSync(curriculumPath, 'utf8');
      const curriculum = JSON.parse(fileContent);
      
      const key = String(gradeNum);
      const topics = curriculum[key] || [];
      return { available: true, topics, key };
    }
  }

  return { available: false, topics: [], key: null };
}

// GET /api/curriculum/topics
// Returns only summaries (id, name, recommendedHours) for class selection.
// Soft-authenticates to load teacher's custom curriculum if requested by a teacher.
router.get('/topics', async (req, res) => {
  try {
    const { subject, grade } = req.query;

    if (!subject || !grade) {
      return res.status(400).json({ message: 'A tantárgy és évfolyam paraméter megadása kötelező.' });
    }

    const normSubject = subject.trim().toLowerCase();
    const gradeMatch = String(grade).match(/^(\d+)/);
    const gradeNum = gradeMatch ? parseInt(gradeMatch[1], 10) : null;

    if (!gradeNum) {
      return res.json({ available: false, message: 'Érvénytelen évfolyam formátum.' });
    }

    // Soft-autentikáció a tanári egyedi tanterv lekérdezéséhez
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let userId = null;
    let userRole = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        userRole = decoded.role;
      } catch (err) {
        // Ignoráljuk a token hibát, és a diák/alapértelmezett ággal folytatjuk
      }
    }

    if (userRole === 'teacher' && userId) {
      const customCurriculum = await TeacherCurriculum.findOne({
        teacherId: userId,
        subject: normSubject,
        grade: String(gradeNum)
      });

      if (customCurriculum && customCurriculum.topics && customCurriculum.topics.length > 0) {
        return res.json({
          available: true,
          subject,
          grade: gradeNum,
          topics: customCurriculum.topics.map(t => ({
            id: t.id,
            name: t.name,
            recommendedHours: t.recommendedHours
          }))
        });
      }
    }

    // Visszalépés az alapértelmezett JSON-re
    const defaultData = getDefaultCurriculum(normSubject, gradeNum);
    if (defaultData.available) {
      return res.json({
        available: true,
        subject,
        grade: gradeNum,
        topics: defaultData.topics.map(t => ({
          id: t.id,
          name: t.name,
          recommendedHours: t.recommendedHours
        }))
      });
    }

    return res.json({
      available: false,
      message: 'Ehhez a tantárgyhoz és évfolyamhoz jelenleg nem áll rendelkezésre a részletes nemzeti kerettanterv.'
    });

  } catch (error) {
    console.error('[Curriculum API GET /topics] Error:', error);
    res.status(500).json({ message: 'Belső hiba a tanterv lekérdezésekor.', error: error.message });
  }
});

// GET /api/curriculum/detail
// Returns detailed topics (all fields) for the teacher's config dashboard.
// Requires teacher authentication.
router.get('/detail', authenticateTeacher, async (req, res) => {
  try {
    const { subject, grade } = req.query;

    if (!subject || !grade) {
      return res.status(400).json({ message: 'A tantárgy és évfolyam paraméterek megadása kötelező.' });
    }

    const normSubject = subject.trim().toLowerCase();

    // Megpróbáljuk betölteni az egyedi tantervet a DB-ből
    const customCurriculum = await TeacherCurriculum.findOne({
      teacherId: req.userId,
      subject: normSubject,
      grade: String(grade)
    });

    if (customCurriculum) {
      return res.json({
        custom: true,
        subject,
        grade,
        topics: customCurriculum.topics
      });
    }

    // Ha nincs egyedi, visszatérünk a NAT szerinti alapértelmezett részletes tantervvel
    const gradeNum = parseInt(grade, 10);
    const defaultData = getDefaultCurriculum(normSubject, gradeNum);

    if (defaultData.available) {
      return res.json({
        custom: false,
        subject,
        grade,
        topics: defaultData.topics
      });
    }

    return res.status(404).json({
      message: 'Ehhez a tantárgyhoz és évfolyamhoz jelenleg nem áll rendelkezésre részletes kerettanterv.'
    });

  } catch (error) {
    console.error('[Curriculum API GET /detail] Error:', error);
    res.status(500).json({ message: 'Belső hiba a tanterv részleteinek lekérdezésekor.', error: error.message });
  }
});

// PUT /api/curriculum
// Saves or updates the teacher's custom curriculum.
// Requires teacher authentication.
router.put('/', authenticateTeacher, async (req, res) => {
  try {
    const { subject, grade, topics } = req.body;

    if (!subject || !grade || !Array.isArray(topics)) {
      return res.status(400).json({ message: 'A tantárgy, évfolyam és témakörök megadása kötelező.' });
    }

    const normSubject = subject.trim().toLowerCase();

    // Validáljuk és formázzuk a témaköröket
    const formattedTopics = topics.map((t, idx) => ({
      id: t.id || `custom_topic_${Date.now()}_${idx}`,
      name: t.name ? String(t.name).trim() : 'Névtelen témakör',
      recommendedHours: Number(t.recommendedHours) || 0,
      learningOutcomes: t.learningOutcomes ? String(t.learningOutcomes).trim() : '',
      developmentalTasks: t.developmentalTasks ? String(t.developmentalTasks).trim() : '',
      concepts: t.concepts ? String(t.concepts).trim() : '',
      suggestedActivities: t.suggestedActivities ? String(t.suggestedActivities).trim() : ''
    }));

    // Upsert a DB-ben
    const updatedCurriculum = await TeacherCurriculum.findOneAndUpdate(
      { teacherId: req.userId, subject: normSubject, grade: String(grade) },
      { topics: formattedTopics },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: 'A tanterv sikeresen elmentve!',
      curriculum: updatedCurriculum
    });

  } catch (error) {
    console.error('[Curriculum API PUT /] Error:', error);
    res.status(500).json({ message: 'Belső hiba a tanterv mentésekor.', error: error.message });
  }
});

// DELETE /api/curriculum
// Deletes a teacher's custom curriculum (resets it to default).
// Requires teacher authentication.
router.delete('/', authenticateTeacher, async (req, res) => {
  try {
    const { subject, grade } = req.body;

    // Ellenőrizzük mindkettőt, mert küldhető query-ben és body-ban is
    const targetSubject = subject || req.query.subject;
    const targetGrade = grade || req.query.grade;

    if (!targetSubject || !targetGrade) {
      return res.status(400).json({ message: 'A tantárgy és évfolyam megadása kötelező.' });
    }

    const normSubject = targetSubject.trim().toLowerCase();

    const deleteResult = await TeacherCurriculum.deleteOne({
      teacherId: req.userId,
      subject: normSubject,
      grade: String(targetGrade)
    });

    if (deleteResult.deletedCount > 0) {
      return res.json({
        success: true,
        message: 'A tanterv sikeresen visszaállítva az alapértelmezett nemzeti kerettantervre!'
      });
    }

    return res.json({
      success: true,
      message: 'A tanterv már az alapértelmezett nemzeti kerettanterven volt.'
    });

  } catch (error) {
    console.error('[Curriculum API DELETE /] Error:', error);
    res.status(500).json({ message: 'Belső hiba a tanterv visszaállításakor.', error: error.message });
  }
});

module.exports = router;
