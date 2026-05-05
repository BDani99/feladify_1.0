const express = require('express');
const jwt = require('jsonwebtoken'); // Importáljuk a JWT-t a token kezeléséhez
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Class = require('../models/Class');
const { generateText, generateChat } = require('../services/groq');
const router = express.Router();
const authenticateTeacher = require('../middleware/authenticateTeacher');
const authenticateStudent = require('../middleware/authenticateStudent');
const authenticateUser = require('../middleware/authenticateUser');

const DIFFICULTY_DESCRIPTIONS = {
  'Könnyű': 'egyszerű, egylépéses kérdések, amelyek közvetlen tényismeretet mérnek, 1-4. osztályos szinten',
  'Közepes': 'többlépéses kérdések, amelyek megértést és alkalmazást igényelnek, 5-6. osztályos szinten',
  'Nehéz': 'összetett kérdések, amelyek analízist és kritikus gondolkodást igényelnek, 7-8. osztályos szinten',
};

function getDifficultyDescription(difficulty, className) {
  if (DIFFICULTY_DESCRIPTIONS[difficulty]) return DIFFICULTY_DESCRIPTIONS[difficulty];
  const match = className && className.match(/^(\d+)/);
  const grade = match ? parseInt(match[1]) : null;
  if (grade) {
    if (difficulty === 'Könnyített') return `a ${grade}. osztályos tananyag könnyebb, alapszintű kérdései – az anyag egyszerűbb részei, könnyen megválaszolható feladatok ${grade}. osztályos tanulók számára`;
    if (difficulty === 'Normál')     return `a ${grade}. osztályos tananyagnak megfelelő, standard nehézségű kérdések – az elvárható tudásszint szerint`;
    if (difficulty === 'Kihívás')    return `a ${grade}. osztályos tananyag mélyebb megértését igénylő, összetettebb feladatok – kihívást jelentő, gondolkodtató kérdések ${grade}. osztályos szinten`;
  }
  return difficulty;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseJsonQuestions(text) {
  const attempts = [
    () => JSON.parse(text),
    () => { const m = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/); if (m) return JSON.parse(m[1]); },
    () => { const m = text.match(/\{[\s\S]+\}/); if (m) return JSON.parse(m[0]); },
  ];
  for (const attempt of attempts) {
    try { const r = attempt(); if (r) return r; } catch {}
  }
  return null;
}

// Közös AI generálás helper (nem ment DB-be)
async function generateQuestions(subject, title, diffDesc, resolvedTypes) {
  const allQuestions = [];
  for (const { type, count } of resolvedTypes) {
    let prompt;
    if (type === 'feleletvalasztos') {
      prompt = `Készíts pontosan ${count} db feleletválasztós ${subject} kérdést a(z) "${title}" témakörből.
Nehézség: ${diffDesc}.
Minden kérdésnek legyen 4 válaszlehetősége (A, B, C, D), amelyek közül pontosan egy helyes.
A kérdések és válaszok legyenek általános iskolás szintűek, rövidek és egyértelműek.

Kizárólag ezt a JSON formátumot add vissza, semmi mást, semmi magyarázat:
{"questions":[{"questionText":"Kérdés szövege","options":["A: első lehetőség","B: második lehetőség","C: harmadik lehetőség","D: negyedik lehetőség"],"correctAnswer":"A: első lehetőség"}]}`;
    } else {
      prompt = `Készíts pontosan ${count} db nyílt végű ${subject} kérdést a(z) "${title}" témakörből.
Nehézség: ${diffDesc}.
Minden kérdésre adj rövid, pontos helyes választ (1-2 mondat).
A kérdések és válaszok legyenek általános iskolás szintűek és egyértelműek.

Kizárólag ezt a JSON formátumot add vissza, semmi mást, semmi magyarázat:
{"questions":[{"questionText":"Kérdés szövege","correctAnswer":"Helyes válasz szövege"}]}`;
    }
    const responseText = await generateText(prompt);
    const parsed = parseJsonQuestions(responseText);
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('A kérdések generálása sikertelen. Kérjük, próbálja újra.');
    }
    const mapped = parsed.questions.slice(0, count).map(q => ({
      questionText: (q.questionText || '').trim(),
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: (q.correctAnswer || '').trim() || null,
      points: 1,
    }));
    allQuestions.push(...mapped);
  }
  return shuffleArray(allQuestions);
}

function resolveQuestionTypes(body) {
  if (Array.isArray(body.questionTypes) && body.questionTypes.length > 0) {
    return body.questionTypes.filter(t => t.count >= 1 && t.count <= 20);
  }
  const count = Number(body.questionCount) || 5;
  return [{ type: body.questionType || 'nyilt', count }];
}

// Előnézet generálása (DB írás nélkül)
router.post('/teacher/preview', authenticateTeacher, async (req, res) => {
  try {
    const { title, subject, difficulty, className } = req.body;
    const missing = ['title','subject','difficulty','className'].filter(f => !req.body[f]);
    if (missing.length > 0) return res.status(400).json({ message: `Hiányzó mezők: ${missing.join(', ')}.` });

    const validTypes = resolveQuestionTypes(req.body);
    if (validTypes.length === 0) return res.status(400).json({ message: 'Legalább egy kérdéstípust meg kell adni.' });

    const diffDesc = getDifficultyDescription(difficulty, className);
    const questions = await generateQuestions(subject, title, diffDesc, validTypes);

    res.status(200).json({ questions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Hiba történt a generálás során.' });
  }
});

// Szerkesztett dolgozat mentése DB-be
router.post('/teacher/save', authenticateTeacher, async (req, res) => {
  try {
    const { title, subject, difficulty, className, questions, timeLimit, startDate, dueDate } = req.body;
    const missing = ['title','subject','difficulty','className'].filter(f => !req.body[f]);
    if (missing.length > 0) return res.status(400).json({ message: `Hiányzó mezők: ${missing.join(', ')}.` });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Nincsenek kérdések a mentéshez.' });
    }

    const classData = await Class.findOne({ name: className });
    if (!classData) return res.status(400).json({ message: 'Az adott osztály nem található.' });

    const students = await User.find({ role: 'student', className: classData.name }).select('_id');
    if (students.length === 0) return res.status(400).json({ message: 'Nincs diák az adott osztályban.' });

    const cleanQuestions = questions.map(q => ({
      questionText: (q.questionText || '').trim(),
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: (q.correctAnswer || '').trim() || null,
      points: Number(q.points) || 1,
    }));

    const assignment = new Assignment({
      teacherId: req.userId,
      title,
      subject,
      difficulty,
      questions: cleanQuestions,
      studentIds: students.map(s => s._id),
      totalPoints: cleanQuestions.length,
      timeLimit: timeLimit ? Number(timeLimit) : null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: new Date(),
    });

    await assignment.save();
    res.status(201).json({ message: 'Feladatsor sikeresen mentve és hozzárendelve az osztály diákjaihoz.', assignment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a mentés során.' });
  }
});

// Feladatsor generálása, csak tanároknak (legacy - közvetlen mentés)
router.post('/teacher/generate', authenticateTeacher, async (req, res) => {
  try {
    const { title, subject, difficulty, className } = req.body;
    const missing = ['title','subject','difficulty','className'].filter(f => !req.body[f]);
    if (missing.length > 0) return res.status(400).json({ message: `Hiányzó mezők: ${missing.join(', ')}.` });

    const validTypes = resolveQuestionTypes(req.body);
    if (validTypes.length === 0) return res.status(400).json({ message: 'Legalább egy kérdéstípust meg kell adni.' });

    const diffDesc = getDifficultyDescription(difficulty, className);
    const classData = await Class.findOne({ name: className });
    if (!classData) return res.status(400).json({ message: 'Az adott osztály nem található.' });

    const students = await User.find({ role: 'student', className: classData.name }).select('_id');
    if (students.length === 0) return res.status(400).json({ message: 'Nincs diák az adott osztályban.' });

    const questions = await generateQuestions(subject, title, diffDesc, validTypes);

    const assignment = new Assignment({
      teacherId: req.userId, title, subject, difficulty,
      questions, studentIds: students.map(s => s._id),
      totalPoints: questions.length, createdAt: new Date(),
    });
    await assignment.save();
    res.status(201).json({ message: 'Feladatsor sikeresen generálva és hozzárendelve a kiválasztott osztály diákjaihoz', assignment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Hiba történt a feladatsor generálása közben.' });
  }
});

// Új végpont a tanár dolgozatainak lekérdezéséhez
router.get('/teacher/list', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId; // A tanár azonosítója a tokenből

    // Az adatbázisból lekérjük azokat a dolgozatokat, amelyek a tanárhoz tartoznak
    const assignments = await Assignment.find({ teacherId });

    res.status(200).json({ message: 'Tanár dolgozatai sikeresen lekérve', assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a dolgozatok lekérdezése során' });
  }
});

// Dolgozat törlése tanár által
router.delete('/teacher/delete-assignment/:assignmentId', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId; // Tanár azonosítója
    const { assignmentId } = req.params;

    // Ellenőrizzük, hogy a dolgozat a tanárhoz tartozik-e
    const assignment = await Assignment.findOne({ _id: assignmentId, teacherId });
    if (!assignment) {
      return res.status(404).json({ message: 'A dolgozat nem található vagy nincs jogosultsága törölni.' });
    }

    // Töröljük a diákok válaszait a dolgozatról
    await User.updateMany(
      { 'assignments.assignmentId': assignmentId },
      { $pull: { assignments: { assignmentId } } } // A hozzátartozó válaszokat töröljük
    );

    // Töröljük magát a dolgozatot
    await Assignment.findByIdAndDelete(assignmentId);

    res.status(200).json({ message: 'A dolgozat és a hozzá kapcsolódó diák válaszok sikeresen törölve.' });
  } catch (error) {
    console.error('Hiba történt a dolgozat törlése során:', error);
    res.status(500).json({ message: 'Hiba történt a dolgozat törlése során.' });
  }
});

// Statisztikai adatok visszaadása a tanár számára
router.get('/teacher/statistics', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;

    // Összes generált dolgozat száma
    const totalAssignments = await Assignment.countDocuments({ teacherId });

    // Teljesített dolgozatok száma és teljesítési arány
    const completedAssignments = await Assignment.aggregate([
      { $match: { teacherId } },
      { $unwind: "$studentIds" },
      {
        $lookup: {
          from: "users",
          localField: "studentIds",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      { $match: { "student.assignments.assignmentId": { $exists: true } } },
      {
        $group: {
          _id: "$_id",
          completedCount: { $sum: 1 }
        }
      }
    ]);

    const completedAssignmentCount = completedAssignments.length;
    const completionRate = totalAssignments > 0 ? (completedAssignmentCount / totalAssignments) * 100 : 0;

    // Átlagos százalékos pontszám dolgozatonként
    const assignmentsWithScores = await Assignment.aggregate([
      { $match: { teacherId } },
      { $unwind: "$studentIds" },
      {
        $lookup: {
          from: "users",
          localField: "studentIds",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      { $unwind: "$student.assignments" }, // Unwind to access each assignment separately
      { $match: { "student.assignments.assignmentId": { $exists: true } } },
      {
        $match: {
          $expr: {
            $eq: ["$student.assignments.assignmentId", "$_id"] // Ensure we're comparing assignments accurately
          }
        }
      },
      {
        $project: {
          assignmentId: "$_id",
          achievedPoints: "$student.assignments.achievedPoints",
          totalPoints: "$totalPoints"
        }
      },
      {
        $group: {
          _id: "$assignmentId",
          totalAchievedPoints: { $sum: "$achievedPoints" },
          maxScore: { $first: "$totalPoints" },
          count: { $sum: 1 } // Count how many students completed this assignment
        }
      }
    ]);

    // Átlagos százalékos pontszám kiszámítása
    const totalPercentageScores = assignmentsWithScores.reduce((sum, assignment) => {
      const averageScore = assignment.count > 0 ? assignment.totalAchievedPoints / assignment.count : 0;
      const percentageScore = assignment.maxScore > 0 ? (averageScore / assignment.maxScore) * 100 : 0;
      return sum + percentageScore;
    }, 0);

    const avgScorePercentagePerAssignment = assignmentsWithScores.length > 0 ? totalPercentageScores / assignmentsWithScores.length : 0;

    res.status(200).json({
      totalAssignments,
      completedAssignments: completedAssignmentCount,
      completionRate: completionRate.toFixed(2),
      avgScorePercentagePerAssignment: avgScorePercentagePerAssignment.toFixed(2) // Return as percentage
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a statisztikai adatok lekérdezése során.' });
  }
});

// Új végpont a diákok számára elérhető dolgozatok lekérdezéséhez
router.get('/student/list', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId; // A diák azonosítója a tokenből származik

    // Lekérjük a diákhoz tartozó dolgozatokat
    const assignments = await Assignment.find({
      studentIds: studentId,
    });

    res.status(200).json({ message: 'Elérhető dolgozatok sikeresen lekérve', assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt az elérhető dolgozatok lekérdezése során' });
  }
});

// Elérhető dolgozatok lekérdezése
router.get('/student/available-assignments', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;

    // A diák által már megírt dolgozatok ID-jainak lekérdezése
    const student = await User.findById(studentId).select('assignments');
    const completedAssignmentIds = student.assignments.map(assignment => assignment.assignmentId);

    // Azoknak a dolgozatoknak a lekérdezése, amelyek elérhetők a diák számára (nincs benne a completedAssignmentIds-ben)
    const availableAssignments = await Assignment.find({
      studentIds: studentId,
      _id: { $nin: completedAssignmentIds }
    }).select('-questions.correctAnswer'); // A helyes válasz mező kihagyása

    res.status(200).json({ message: 'Elérhető dolgozatok sikeresen lekérve', assignments: availableAssignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt az elérhető dolgozatok lekérdezése során.' });
  }
});

// Megírt dolgozatok lekérdezése
router.get('/student/completed-assignments', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;

    // A diák által megírt dolgozatok lekérdezése a `User` modellből
    const student = await User.findById(studentId)
      .populate({
        path: 'assignments.assignmentId', // Kitöltött dolgozat ID-jának kibővítése a részletekkel
        select: 'title subject totalPoints questions' // Csak a szükséges mezőket adja vissza a dolgozatból
      })
      .select('assignments');

    // A megírt dolgozatokból egy egyszerűsített struktúrát készítünk
    const completedAssignments = student.assignments.map(assignment => ({
      assignmentId: assignment.assignmentId._id,
      title: assignment.assignmentId.title,
      subject: assignment.assignmentId.subject,
      achievedPoints: assignment.achievedPoints,
      totalPoints: assignment.assignmentId.totalPoints,
      completedAt: assignment.completedAt,
      answers: assignment.answers.map(answer => {
        // Megkeresi a kérdés szövegét az eredeti kérdések között
        const question = assignment.assignmentId.questions.find(q => q._id.equals(answer.questionId));
        return {
          questionId: answer.questionId,
          questionText: question ? question.questionText : null,
          studentAnswer: answer.studentAnswer,
          correctAnswer: question ? question.correctAnswer : null,
          score: answer.score
        };
      })
    }));

    res.status(200).json({ message: 'Megírt dolgozatok sikeresen lekérve', assignments: completedAssignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a megírt dolgozatok lekérdezése során.' });
  }
});

// Dolgozat kitöltése a diák által
router.post('/student/submit/:assignmentId', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;
    const { assignmentId } = req.params;
    const { answers } = req.body;

    // Ellenőrizzük a hiányzó mezőket
    const missingFields = [];
    if (!answers || Object.keys(answers).length === 0) missingFields.push('answers');
    if (missingFields.length > 0) {
      return res.status(400).json({ message: `A következő mezők megadása kötelező: ${missingFields.join(', ')}.` });
    }

    // Dolgozat lekérdezése
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Dolgozat nem található.' });
    }

    // Ellenőrizzük, hogy a diák már kitöltötte-e a dolgozatot
    const student = await User.findOne({ _id: studentId, "assignments.assignmentId": assignmentId });
    if (student) {
      return res.status(400).json({ message: 'Már kitöltötte ezt a dolgozatot.' });
    }

    // Get all question IDs in the assignment for validation
    const validQuestionIds = assignment.questions.map(q => q._id.toString());

    // Ellenőrizzük, hogy minden answer kérdés ID érvényes
    const invalidQuestionDetails = Object.keys(answers)
      .filter(questionId => !validQuestionIds.includes(questionId))
      .map(invalidId => {
        const question = assignment.questions.find(q => q._id.toString() === invalidId);
        return {
          questionId: invalidId,
          correctAnswer: question ? question.correctAnswer : "N/A"
        };
      });

    if (invalidQuestionDetails.length > 0) {
      return res.status(400).json({
        message: 'Érvénytelen kérdés azonosítók.',
        invalidQuestions: invalidQuestionDetails
      });
    }

    // Válaszok feldolgozása és pontszám számítása
    let achievedPoints = 0;
    const answerData = [];

    // Loop through each question and evaluate the answer using GPT
    for (const question of assignment.questions) {
      const studentAnswer = answers[question._id];
      let score = 0;

      if (studentAnswer) {
        const evalPrompt = `Is the following answer correct based on the provided correct answer? Please answer "yes" or "no".

Question: ${question.questionText}
Correct Answer: ${question.correctAnswer}
Student's Answer: ${studentAnswer}`;

        const evalResponse = await generateText(evalPrompt);
        const geminiAnswer = evalResponse.trim().toLowerCase();

        if (geminiAnswer.startsWith('yes')) {
          score = question.points;
          achievedPoints += question.points;
        }

        answerData.push({
          questionId: question._id,
          studentAnswer,
          score
        });
      } else {
        // Ha egy kérdéshez nincs válasz, ezt is jelzi
        answerData.push({
          questionId: question._id,
          studentAnswer: null,
          score: 0
        });
      }
    }

    // A diák adatainak frissítése a kitöltött dolgozattal
    await User.findByIdAndUpdate(studentId, {
      $push: {
        assignments: {
          assignmentId,
          answers: answerData,
          achievedPoints,
          completedAt: new Date()
        }
      }
    });

    // Dolgozat completedCount növelése
    assignment.completedCount = (assignment.completedCount || 0) + 1;
    await assignment.save();

    res.status(200).json({
      message: 'Dolgozat sikeresen beküldve.',
      achievedPoints,
      totalPoints: assignment.totalPoints
    });
  } catch (error) {
    console.error(error);

    // Ha mongoose vagy bármilyen más validációs hiba történik
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: `Érvénytelen adatok: ${errorMessages.join(', ')}` });
    }

    res.status(500).json({ message: 'Hiba történt a dolgozat beküldése során.' });
  }
});

// Diák statisztikai adatok lekérése
router.get('/student/statistics', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;

    // Diák adatainak lekérdezése az assignments mezővel
    const student = await User.findById(studentId).populate('assignments.assignmentId', 'title totalPoints');

    if (!student) {
      return res.status(404).json({ message: 'Diák nem található.' });
    }

    // Megírt dolgozatok száma
    const completedAssignmentsCount = student.assignments.length;

    // Átlagos pontszám kiszámítása
    const totalAchievedPoints = student.assignments.reduce((sum, assignment) => sum + assignment.achievedPoints, 0);
    const totalPossiblePoints = student.assignments.reduce((sum, assignment) => sum + assignment.assignmentId.totalPoints, 0);
    const averageScorePercentage = completedAssignmentsCount > 0 ? (totalAchievedPoints / totalPossiblePoints) * 100 : 0;

    // Egyéni dolgozatok statisztikája (cím, elért pontszám, max pontszám, kitöltés dátuma)
    const assignmentsStatistics = student.assignments.map(assignment => ({
      title: assignment.assignmentId.title,
      achievedPoints: assignment.achievedPoints,
      totalPoints: assignment.assignmentId.totalPoints,
      completedAt: assignment.completedAt
    }));

    res.status(200).json({
      completedAssignmentsCount,
      averageScorePercentage,
      assignmentsStatistics
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a statisztikai adatok lekérdezése során.' });
  }
});

const mongoose = require('mongoose');

router.post('/chat', authenticateUser, async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const [teacherAssignments, teacherClasses, teacherUser] = await Promise.all([
      Assignment.find({ teacherId: userObjectId }).lean(),
      Class.find({ teacherIds: userObjectId }).populate('studentIds', 'name className assignments').lean(),
      User.findById(userObjectId).select('-password').lean(),
    ]);

    // Osztályok és diákok formázása
    const classLines = teacherClasses.length > 0
      ? teacherClasses.map(c => {
          const students = c.studentIds || [];
          const studentDetails = students.map(s => {
            const completedCount = (s.assignments || []).length;
            const totalAchieved = (s.assignments || []).reduce((sum, a) => sum + (a.achievedPoints || 0), 0);
            return `    • ${s.name}: ${completedCount} megírt dolgozat, összesen ${totalAchieved} pont`;
          });
          return `  - ${c.name} (${students.length} diák)${studentDetails.length > 0 ? ':\n' + studentDetails.join('\n') : ''}`;
        }).join('\n')
      : '  Nincs hozzárendelt osztály.';

    // Dolgozatok formázása
    const assignmentLines = teacherAssignments.length > 0
      ? teacherAssignments.map(a => {
          const studentCount = (a.studentIds || []).length;
          return `  - "${a.title}" | tantárgy: ${a.subject} | nehézség: ${a.difficulty} | teljesítette: ${a.completedCount || 0}/${studentCount} diák | max pont: ${a.totalPoints}`;
        }).join('\n')
      : '  Még nem hozott létre dolgozatot.';

    const systemPrompt = `Te a Feladify általános iskolai oktatási platform asszisztense vagy. Magyarul, magabiztosan és tömören válaszolj. A felhasználó egy tanár.

=== A TANÁR ADATAI (ezek tények, nem kell hozzájuk kétség) ===
Neve: ${teacherUser.name}
Tantárgyai: ${(teacherUser.subjects || []).join(', ') || 'nincs megadva'}

=== OSZTÁLYAI (ezekben tanít) ===
${classLines}

=== DOLGOZATAI ===
${assignmentLines}
=== VÉGE ===

Szabályok:
1. A fenti adatok PONTOS TÉNYEK a rendszerből. Fogadd el őket igazként és válaszolj belőlük magabiztosan.
2. Ne mondd azt, hogy "nem tudom pontosan" vagy "sajnos nincs információ" ha az adat szerepel fent.
3. Ha valóban nincs adat (pl. üres lista), akkor és csak akkor jelezd.
4. Ne adj általános tudásbázis-választ, csak a fenti adatokra alapozz.
5. Rövid, lényegre törő válaszokat adj.`;

    const responseText = await generateChat(systemPrompt, userMessage);
    res.status(200).json({ message: responseText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a chatbot feldolgozása során.' });
  }
});


// Részletes statisztika: osztályonként, tantárgyanként, top/bottom diákok
router.get('/teacher/detailed-statistics', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);

    const assignments = await Assignment.find({ teacherId: teacherObjectId }).lean();
    const assignmentIds = assignments.map(a => a._id);

    const classes = await Class.find({ teacherIds: teacherObjectId })
      .populate('studentIds', 'name className assignments')
      .lean();

    // Tantárgyankénti bontás
    const subjectMap = {};
    for (const a of assignments) {
      if (!subjectMap[a.subject]) subjectMap[a.subject] = { total: 0, completed: 0 };
      subjectMap[a.subject].total += 1;
      subjectMap[a.subject].completed += a.completedCount || 0;
    }
    const subjectBreakdown = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      totalAssignments: data.total,
      completedCount: data.completed,
    }));

    // Osztályonkénti bontás + diák teljesítmény
    const classBreakdown = [];
    const studentScores = [];

    for (const cls of classes) {
      let classAchieved = 0;
      let classPossible = 0;
      let classCompleted = 0;

      for (const student of cls.studentIds || []) {
        const relevantAnswers = (student.assignments || []).filter(ans =>
          assignmentIds.some(id => id.equals(ans.assignmentId))
        );
        const achieved = relevantAnswers.reduce((sum, a) => sum + (a.achievedPoints || 0), 0);
        const possible = relevantAnswers.reduce((sum, a) => {
          const asgn = assignments.find(x => x._id.equals(a.assignmentId));
          return sum + (asgn ? asgn.totalPoints : 0);
        }, 0);

        classCompleted += relevantAnswers.length;
        classAchieved += achieved;
        classPossible += possible;

        if (possible > 0) {
          studentScores.push({
            name: student.name,
            className: cls.name,
            achievedPoints: achieved,
            possiblePoints: possible,
            percentage: ((achieved / possible) * 100).toFixed(1),
          });
        }
      }

      classBreakdown.push({
        className: cls.name,
        studentCount: (cls.studentIds || []).length,
        completedAssignments: classCompleted,
        avgPercentage: classPossible > 0 ? ((classAchieved / classPossible) * 100).toFixed(1) : '0.0',
      });
    }

    studentScores.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    const topStudents = studentScores.slice(0, 5);
    const bottomStudents = [...studentScores].reverse().slice(0, 5);

    res.status(200).json({ classBreakdown, subjectBreakdown, topStudents, bottomStudents });
  } catch (error) {
    console.error('Részletes statisztika hiba:', error);
    res.status(500).json({ message: 'Hiba történt a részletes statisztikák lekérdezése során.' });
  }
});

module.exports = router;
