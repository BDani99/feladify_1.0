const express = require('express');
const jwt = require('jsonwebtoken'); // Importáljuk a JWT-t a token kezeléséhez
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Class = require('../models/Class');
const { generateText, generateChat, generateChatWithHistory } = require('../services/ai');
const aiService = require('../services/aiService');
const Notification = require('../models/Notification');

async function notify(userId, type, title, message, data = {}) {
  try {
    await Notification.create({ userId, type, title, message, data });
  } catch (e) {
    console.error('[Notification] Létrehozási hiba:', e.message);
  }
}
const router = express.Router();
const authenticateTeacher = require('../middleware/authenticateTeacher');
const authenticateStudent = require('../middleware/authenticateStudent');
const authenticateUser = require('../middleware/authenticateUser');
const realtimeService = require('../services/realtimeService');

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

const TYPE_MAPPING = {
  'nyilt': 'short_answer',
  'feleletvalasztos': 'mcq',
  'igaz_hamis': 'true_false',
  'parositas': 'matching',
  'sorbarendezes': 'ordering',
  'hianyos_szoveg': 'fill_blank'
};

// AI generálás – egyetlen hívásban, pontos típus/darabszám arányban
async function generateQuestions(subject, title, diffDesc, resolvedTypes, grade, selectedTopics, userId = null) {
  const typeSpecs = resolvedTypes.map(({ type, count }) => ({
    type: TYPE_MAPPING[type] || type,
    count
  }));

  const rawQuestions = await aiService.generateExamQuestionSet(subject, title, diffDesc, typeSpecs, grade, selectedTopics, userId);

  // MCQ integritás: correctAnswer mindig az options között legyen
  const normStr = s => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  const questions = rawQuestions.map((q, idx) => {
    if (q.questionType === 'mcq' && Array.isArray(q.options) && q.options.length > 0) {
      const matchIdx = q.options.findIndex(o => normStr(o) === normStr(q.correctAnswer));
      if (matchIdx === -1) {
        console.warn(`[assignments] MCQ q${idx + 1} correctAnswer nem volt options-ban, javítva`);
        const newOptions = [...q.options];
        newOptions[newOptions.length - 1] = String(q.correctAnswer ?? 'Helyes válasz');
        return { ...q, options: newOptions.sort(() => Math.random() - 0.5) };
      }
    }
    return q;
  });

  return shuffleArray(questions.map(q => ({
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options || [],
    pairs: q.pairs || [],
    items: q.items || [],
    correctAnswer: q.correctAnswer,
    points: 1,
  })));
}

function resolveQuestionTypes(body) {
  if (Array.isArray(body.questionTypes) && body.questionTypes.length > 0) {
    return body.questionTypes.filter(t => t.count >= 1 && t.count <= 20);
  }
  const count = Number(body.questionCount) || 5;
  return [{ type: body.questionType || 'nyilt', count }];
}

function normalizeAndValidateQuestions(questions) {
  const sanitized = aiService._sanitizeQuestions(questions.map(q => ({
    questionText: (q.questionText || '').trim(),
    questionType: q.questionType || 'short_answer',
    options: Array.isArray(q.options) ? q.options : [],
    pairs: Array.isArray(q.pairs) ? q.pairs : [],
    items: Array.isArray(q.items) ? q.items : [],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || '',
  })), 3);

  const invalid = sanitized
    .map((q, index) => ({ index, validation: aiService._validateQuestion(q) }))
    .filter(item => !item.validation.valid);

  if (invalid.length > 0) {
    const details = invalid
      .slice(0, 3)
      .map(item => `${item.index + 1}. kérdés: ${item.validation.reasons.join(', ')}`)
      .join('; ');
    const suffix = invalid.length > 3 ? ` (+${invalid.length - 3} további hiba)` : '';
    const error = new Error(`Hibás kérdés-válasz struktúra: ${details}${suffix}`);
    error.statusCode = 400;
    throw error;
  }

  return sanitized.map((q, idx) => ({
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options || [],
    pairs: q.pairs || [],
    items: q.items || [],
    correctAnswer: q.correctAnswer,
    points: Math.max(1, Number(questions[idx]?.points) || 1),
  }));
}

function sanitizeQuestionForStudent(question) {
  const base = question.toObject ? question.toObject() : { ...question };
  delete base.correctAnswer;

  if (base.questionType === 'matching') {
    const pairs = Array.isArray(base.pairs) ? base.pairs : [];
    const rightOptions = Array.isArray(base.options) && base.options.length === pairs.length
      ? base.options
      : shuffleArray(pairs.map(pair => pair.right).filter(Boolean));

    base.pairs = shuffleArray(pairs.map(pair => ({ left: pair.left, right: '' })));
    base.options = shuffleArray([...rightOptions]);
  }

  return base;
}

function sanitizeAssignmentForStudent(assignment) {
  const plain = assignment.toObject ? assignment.toObject() : { ...assignment };
  plain.questions = (plain.questions || []).map(sanitizeQuestionForStudent);
  return plain;
}

// Előnézet generálása (DB írás nélkül)
router.post('/teacher/preview', authenticateTeacher, async (req, res) => {
  try {
    const { title, subject, difficulty, className, selectedTopics, topicSpecification } = req.body;
    const missing = ['title','subject','difficulty','className'].filter(f => !req.body[f]);
    if (missing.length > 0) return res.status(400).json({ message: `Hiányzó mezők: ${missing.join(', ')}.` });

    const validTypes = resolveQuestionTypes(req.body);
    if (validTypes.length === 0) return res.status(400).json({ message: 'Legalább egy kérdéstípust meg kell adni.' });

    const diffDesc = getDifficultyDescription(difficulty, className);
    const gradeMatch = className && className.match(/^(\d+)/);
    const grade = gradeMatch ? `${gradeMatch[1]}. osztály` : 'általános iskola';

    const combinedTopic = topicSpecification
      ? `${title} (Részletes specifikáció: ${topicSpecification})`
      : title;

    const questions = await generateQuestions(subject, combinedTopic, diffDesc, validTypes, grade, selectedTopics, req.userId);

    res.status(200).json({ questions });
  } catch (error) {
    console.error(error);
    const isAI = error.message?.includes('nem elérhető');
    res.status(isAI ? 503 : 500).json({ message: error.message || 'Hiba történt a generálás során.', aiUnavailable: isAI });
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

    const classStudents = await User.find({ role: 'student', className: classData.name }).select('_id');
    if (classStudents.length === 0) return res.status(400).json({ message: 'Nincs diák az adott osztályban.' });

    let students = classStudents;
    if (Array.isArray(req.body.studentIds) && req.body.studentIds.length > 0) {
      students = classStudents.filter(s => req.body.studentIds.includes(s._id.toString()));
      if (students.length === 0) {
        return res.status(400).json({ message: 'A megadott diákok egyike sem található az osztályban.' });
      }
    }

    const cleanQuestions = normalizeAndValidateQuestions(questions);

    const assignment = new Assignment({
      teacherId: req.userId,
      title,
      subject,
      difficulty,
      questions: cleanQuestions,
      studentIds: students.map(s => s._id),
      totalPoints: cleanQuestions.reduce((sum, q) => sum + (q.points || 1), 0),
      timeLimit: timeLimit ? Number(timeLimit) : null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: new Date(),
    });

    await assignment.save();

    // Értesítés minden diáknak és szüleiknek
    const notifMsg = `Új dolgozat érkezett: "${title}" – ${subject}`;
    const studentIdStrings = students.map(s => String(s._id));
    students.forEach(s => notify(s._id, 'new_assignment', 'Új dolgozat kiírva', notifMsg, { assignmentId: assignment._id }));
    User.find({ role: 'parent', children: { $in: students.map(s => s._id) } }).select('_id').lean().then(parents => {
      parents.forEach(p => notify(p._id, 'new_assignment', 'Gyermeked új dolgozatot kapott', notifMsg, { assignmentId: assignment._id }));
    }).catch(() => {});

    // SSE valós idejű push az online diákoknak
    realtimeService.sendToUsers(studentIdStrings, 'new_assignment', {
      assignmentId: String(assignment._id),
      title,
      subject
    });

    res.status(201).json({ message: 'Feladatsor sikeresen mentve és hozzárendelve az osztály diákjaihoz.', assignment });
  } catch (error) {
    console.error(error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Hiba történt a mentés során.' });
  }
});

// Feladatsor generálása, csak tanároknak (legacy - közvetlen mentés)
router.post('/teacher/generate', authenticateTeacher, async (req, res) => {
  try {
    const { title, subject, difficulty, className, selectedTopics, topicSpecification } = req.body;
    const missing = ['title','subject','difficulty','className'].filter(f => !req.body[f]);
    if (missing.length > 0) return res.status(400).json({ message: `Hiányzó mezők: ${missing.join(', ')}.` });

    const validTypes = resolveQuestionTypes(req.body);
    if (validTypes.length === 0) return res.status(400).json({ message: 'Legalább egy kérdéstípust meg kell adni.' });

    const diffDesc = getDifficultyDescription(difficulty, className);
    const classData = await Class.findOne({ name: className });
    if (!classData) return res.status(400).json({ message: 'Az adott osztály nem található.' });

    const classStudents = await User.find({ role: 'student', className: classData.name }).select('_id');
    if (classStudents.length === 0) return res.status(400).json({ message: 'Nincs diák az adott osztályban.' });

    let students = classStudents;
    if (Array.isArray(req.body.studentIds) && req.body.studentIds.length > 0) {
      students = classStudents.filter(s => req.body.studentIds.includes(s._id.toString()));
      if (students.length === 0) {
        return res.status(400).json({ message: 'A megadott diákok egyike sem található az osztályban.' });
      }
    }

    const gradeMatch = className && className.match(/^(\d+)/);
    const grade = gradeMatch ? `${gradeMatch[1]}. osztály` : 'általános iskola';

    const combinedTopic = topicSpecification
      ? `${title} (Részletes specifikáció: ${topicSpecification})`
      : title;

    const questions = await generateQuestions(subject, combinedTopic, diffDesc, validTypes, grade, selectedTopics, req.userId);

    const assignment = new Assignment({
      teacherId: req.userId, title, subject, difficulty,
      questions, studentIds: students.map(s => s._id),
      totalPoints: questions.reduce((sum, q) => sum + (q.points || 1), 0), createdAt: new Date(),
    });
    await assignment.save();

    // Értesítés minden diáknak és szüleiknek
    const genNotifMsg = `Új dolgozat érkezett: "${title}" – ${subject}`;
    const genStudentIdStrings = students.map(s => String(s._id));
    students.forEach(s => notify(s._id, 'new_assignment', 'Új dolgozat kiírva', genNotifMsg, { assignmentId: assignment._id }));
    User.find({ role: 'parent', children: { $in: students.map(s => s._id) } }).select('_id').lean().then(parents => {
      parents.forEach(p => notify(p._id, 'new_assignment', 'Gyermeked új dolgozatot kapott', genNotifMsg, { assignmentId: assignment._id }));
    }).catch(() => {});

    // SSE valós idejű push az online diákoknak
    realtimeService.sendToUsers(genStudentIdStrings, 'new_assignment', {
      assignmentId: String(assignment._id),
      title,
      subject
    });

    res.status(201).json({ message: 'Feladatsor sikeresen generálva és hozzárendelve a kiválasztott osztály diákjaihoz', assignment });
  } catch (error) {
    console.error(error);
    const isAI = error.message?.includes('nem elérhető');
    res.status(isAI ? 503 : 500).json({ message: error.message || 'Hiba történt a feladatsor generálása közben.', aiUnavailable: isAI });
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

    res.status(200).json({
      message: 'Elérhető dolgozatok sikeresen lekérve',
      assignments: assignments.map(sanitizeAssignmentForStudent)
    });
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
    }); // A helyes válaszokat és párosítási kulcsokat kézzel sanitizáljuk

    res.status(200).json({
      message: 'Elérhető dolgozatok sikeresen lekérve',
      assignments: availableAssignments.map(sanitizeAssignmentForStudent)
    });
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
    // correctAnswer csak akkor jelenik meg ha a tanár már értékelte (grade != null)
    const completedAssignments = student.assignments.filter(a => a.assignmentId != null).map(assignment => {
      const isGraded = assignment.grade != null;
      return {
        assignmentId: assignment.assignmentId._id,
        title: assignment.assignmentId.title,
        subject: assignment.assignmentId.subject,
        achievedPoints: assignment.achievedPoints,
        totalPoints: assignment.assignmentId.totalPoints,
        completedAt: assignment.completedAt,
        grade: assignment.grade ?? null,
        answers: assignment.answers.map(answer => {
          const question = assignment.assignmentId.questions.find(q => q._id.equals(answer.questionId));
          const base = {
            questionId: answer.questionId,
            questionText: question ? question.questionText : null,
            questionType: question ? question.questionType : 'short_answer',
            studentAnswer: answer.studentAnswer,
            score: answer.score,
            maxPoints: question ? question.points : 1,
            flagged: answer.flagged ?? false,
            flagResponse: answer.flagResponse || '',
            flagRejected: answer.flagRejected ?? false,
          };
          // Helyes válasz és kérdéstípus csak értékelés után látható
          if (isGraded) {
            base.correctAnswer = question ? question.correctAnswer : null;
          }
          return base;
        })
      };
    });

    res.status(200).json({ message: 'Megírt dolgozatok sikeresen lekérve', assignments: completedAssignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a megírt dolgozatok lekérdezése során.' });
  }
});

// Megírt konkrét dolgozat részleteinek lekérdezése
router.get('/student/completed-assignments/:assignmentId', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;
    const { assignmentId } = req.params;

    const student = await User.findById(studentId)
      .populate({
        path: 'assignments.assignmentId',
        select: 'title subject totalPoints questions'
      })
      .select('assignments');

    const assignmentSub = student.assignments.find(a => a.assignmentId && a.assignmentId._id.toString() === assignmentId.toString() && !a.isDraft);
    if (!assignmentSub) {
      return res.status(404).json({ message: 'A dolgozat nem található a megírtak között.' });
    }

    const isGraded = assignmentSub.grade != null;
    const result = {
      assignmentId: assignmentSub.assignmentId._id,
      title: assignmentSub.assignmentId.title,
      subject: assignmentSub.assignmentId.subject,
      achievedPoints: assignmentSub.achievedPoints,
      totalPoints: assignmentSub.assignmentId.totalPoints,
      completedAt: assignmentSub.completedAt,
      grade: assignmentSub.grade ?? null,
      answers: assignmentSub.answers.map(answer => {
        const question = assignmentSub.assignmentId.questions.find(q => q._id.equals(answer.questionId));
        const base = {
          questionId: answer.questionId,
          questionText: question ? question.questionText : null,
          questionType: question ? question.questionType : 'short_answer',
          studentAnswer: answer.studentAnswer,
          score: answer.score,
          maxPoints: question ? question.points : 1,
          flagged: answer.flagged ?? false,
          flagResponse: answer.flagResponse || '',
          flagRejected: answer.flagRejected ?? false,
        };
        if (isGraded) {
          base.correctAnswer = question ? question.correctAnswer : null;
        }
        return base;
      })
    };

    res.status(200).json({ assignment: result });
  } catch (error) {
    console.error('[Assignment API] Completed assignment detail error:', error);
    res.status(500).json({ message: 'Hiba a megírt dolgozat részleteinek lekérdezése során.' });
  }
});

// Dolgozat részleges mentése (Autosave) a diák által
router.post('/student/autosave/:assignmentId', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;
    const { assignmentId } = req.params;
    const { answers } = req.body;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Dolgozat nem található.' });
    }

    // Ellenőrizzük, hogy van-e már véglegesített dolgozat
    const alreadyCompleted = await User.findOne({
      _id: studentId,
      assignments: {
        $elemMatch: { assignmentId, isDraft: false }
      }
    });
    if (alreadyCompleted) {
      return res.status(400).json({ message: 'Ezt a dolgozatot már véglegesen beküldte.' });
    }

    const answerData = [];
    if (answers && typeof answers === 'object') {
      for (const question of assignment.questions) {
        const studentAnswer = answers[question._id];
        if (studentAnswer !== undefined && studentAnswer !== null) {
          answerData.push({
            questionId: question._id,
            studentAnswer,
            score: 0,
            confidence: 1.0,
            aiFeedback: ''
          });
        }
      }
    }

    // Megkeressük, van-e már draft ehhez a dolgozathoz
    const studentUser = await User.findById(studentId);
    const existingDraftIndex = studentUser.assignments.findIndex(a => a.assignmentId.toString() === assignmentId);

    if (existingDraftIndex !== -1) {
      // Frissítjük a meglévő draftot
      studentUser.assignments[existingDraftIndex].answers = answerData;
      studentUser.assignments[existingDraftIndex].completedAt = new Date();
      studentUser.assignments[existingDraftIndex].isDraft = true;
    } else {
      // Létrehozunk egy újat
      studentUser.assignments.push({
        assignmentId,
        answers: answerData,
        achievedPoints: 0,
        suggestedGrade: null,
        grade: null,
        completedAt: new Date(),
        isDraft: true
      });
    }

    await studentUser.save();
    res.status(200).json({ message: 'Piszkozat sikeresen mentve (autosave).' });
  } catch (error) {
    console.error('[Autosave Error]', error);
    res.status(500).json({ message: 'Hiba a piszkozat mentése során.' });
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

    // Ellenőrizzük, hogy a diák már kitöltötte-e a dolgozatot véglegesen
    const student = await User.findOne({
      _id: studentId,
      assignments: {
        $elemMatch: { assignmentId, isDraft: false }
      }
    });
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

    for (const question of assignment.questions) {
      const studentAnswer = answers[question._id];
      let score = 0;
      let confidence = 1.0;
      let aiFeedback = '';

      if (studentAnswer !== undefined && studentAnswer !== null) {
        const type = question.questionType || 'short_answer';

        if (type === 'mcq' || type === 'true_false' || type === 'fill_blank') {
          // Egyszerű szöveges egyezés
          const norm = (s) => String(s || '').toLowerCase().trim();
          if (norm(studentAnswer) === norm(question.correctAnswer)) {
            score = question.points;
          }
        } else if (type === 'ordering') {
          // Sorrend egyezés (tömbök)
          if (Array.isArray(studentAnswer) && Array.isArray(question.correctAnswer)) {
            const isCorrect = studentAnswer.length === question.correctAnswer.length &&
              studentAnswer.every((val, index) => val === question.correctAnswer[index]);
            if (isCorrect) score = question.points;
          }
        } else if (type === 'matching') {
          // Párosítás egyezés (objektum)
          if (typeof studentAnswer === 'object' && typeof question.correctAnswer === 'object') {
            let correctCount = 0;
            const keys = Object.keys(question.correctAnswer);
            keys.forEach(key => {
              if (studentAnswer[key] === question.correctAnswer[key]) correctCount++;
            });
            // Részpontszám vagy mindent-vagy-semmit? Legyen mindent-vagy-semmit az egyszerűség kedvéért most
            if (correctCount === keys.length) score = question.points;
          }
        } else if (type === 'short_answer') {
          // Nyílt végű: AI értékelés
          try {
            const evaluation = await aiService.checkShortTextAnswer(
              assignment.subject,
              question.questionText,
              studentAnswer,
              question.correctAnswer
            );
            if (evaluation.correct) score = question.points;
            aiFeedback = evaluation.reason;
            confidence = evaluation.confidence ?? 0.8;
          } catch (err) {
            console.error('AI grading error:', err);
            // Fallback: egyszerű tartalmazás vizsgálat
            if (String(studentAnswer).toLowerCase().includes(String(question.correctAnswer).toLowerCase())) {
              score = question.points;
            }
          }
        }
        
        achievedPoints += score;
        answerData.push({ 
          questionId: question._id, 
          studentAnswer, 
          score, 
          confidence,
          aiFeedback 
        });
      } else {
        answerData.push({ questionId: question._id, studentAnswer: null, score: 0, confidence: 1.0 });
      }
    }

    // Osztályzat javaslat
    let suggestedGrade = 1;
    const percentage = assignment.totalPoints > 0
        ? (achievedPoints / assignment.totalPoints) * 100
        : 0;
    if (percentage >= 90) suggestedGrade = 5;
    else if (percentage >= 80) suggestedGrade = 4;
    else if (percentage >= 65) suggestedGrade = 3;
    else if (percentage >= 50) suggestedGrade = 2;
    else suggestedGrade = 1;

    // A diák adatainak frissítése a kitöltött dolgozattal (draft felülírása vagy új hozzáadása)
    const userDoc = await User.findById(studentId);
    const existingIndex = userDoc.assignments.findIndex(a => a.assignmentId.toString() === assignmentId);

    if (existingIndex !== -1) {
      userDoc.assignments[existingIndex] = {
        assignmentId,
        answers: answerData,
        achievedPoints,
        suggestedGrade,
        grade: null,
        completedAt: new Date(),
        isDraft: false
      };
    } else {
      userDoc.assignments.push({
        assignmentId,
        answers: answerData,
        achievedPoints,
        suggestedGrade,
        grade: null,
        completedAt: new Date(),
        isDraft: false
      });
    }
    await userDoc.save();

    // Dolgozat completedCount növelése
    assignment.completedCount = (assignment.completedCount || 0) + 1;
    await assignment.save();

    // Értesítés a tanárnak (fire-and-forget)
    User.findById(studentId).select('name').then(submitter => {
      const studentName = submitter?.name || 'Egy diák';
      notify(
        assignment.teacherId,
        'assignment_submitted',
        'Dolgozat beküldve',
        `${studentName} beadta: "${assignment.title}"`,
        { assignmentId, studentId }
      );
    }).catch(() => {});

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

// Diák "Nem értem" jelzés beküldése
router.patch('/student/flag-answer', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;
    const { assignmentId, questionId } = req.body;
    if (!assignmentId || !questionId) {
      return res.status(400).json({ message: 'assignmentId és questionId megadása kötelező.' });
    }
    const mongoose = require('mongoose');
    const aId = new mongoose.Types.ObjectId(assignmentId);
    const qId = new mongoose.Types.ObjectId(questionId);
    const result = await User.updateOne(
      { _id: studentId },
      { $set: { 'assignments.$[a].answers.$[ans].flagged': true } },
      { arrayFilters: [{ 'a.assignmentId': aId }, { 'ans.questionId': qId }] }
    );
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Válasz nem található.' });
    }

    // Tanár értesítése
    const assignment = await Assignment.findById(assignmentId).select('teacherId title');
    const student = await User.findById(studentId).select('name');
    if (assignment && student) {
      const question = assignment.questions?.find(q => q._id.equals(qId));
      const questionText = question?.questionText || 'kérdés';
      await notify(
        assignment.teacherId,
        'answer_flagged',
        'Diák reklamációt nyújtott be',
        `${student.name} nem érti a javítást – "${assignment.title}" – "${questionText.substring(0, 60)}${questionText.length > 60 ? '…' : ''}"`,
        { assignmentId, studentId, questionId }
      );
    }

    res.json({ message: 'Jelzés elküldve.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a jelzés mentésekor.' });
  }
});

// Tanár: diákok válaszainak lekérése egy dolgozathoz
router.get('/teacher/assignment-submissions/:assignmentId', authenticateTeacher, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Dolgozat nem található.' });

    const students = await User.find({ 'assignments.assignmentId': assignmentId }).select('name assignments');

    const submissions = students.map(student => {
      const submission = student.assignments.find(a => a.assignmentId.equals(assignmentId));
      if (!submission) return null;
      return {
        studentId: student._id,
        studentName: student.name,
        achievedPoints: submission.achievedPoints,
        totalPoints: assignment.totalPoints,
        suggestedGrade: submission.suggestedGrade,
        grade: submission.grade,
        completedAt: submission.completedAt,
        answers: submission.answers.map(answer => {
          const question = assignment.questions.find(q => q._id.equals(answer.questionId));
          return {
            questionId: answer.questionId,
            questionText: question ? question.questionText : null,
            questionType: question ? question.questionType : 'short_answer',
            options: question ? question.options : [],
            pairs: question ? question.pairs : [],
            items: question ? question.items : [],
            studentAnswer: answer.studentAnswer,
            correctAnswer: question ? question.correctAnswer : null,
            score: answer.score,
            maxPoints: question ? question.points : 1,
            confidence: answer.confidence ?? null,
            aiFeedback: answer.aiFeedback || '',
            flagged: answer.flagged ?? false,
            flagResponse: answer.flagResponse || '',
            flagRejected: answer.flagRejected ?? false,
          };
        }),
      };
    }).filter(Boolean);

    res.json({ submissions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a beküldések lekérésekor.' });
  }
});

// Tanár: Dolgozat eredmények exportálása CSV fájlba a saját Dokumentumokba
router.post('/teacher/export-submissions/:assignmentId', authenticateTeacher, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const teacherId = req.userId;

    const assignment = await Assignment.findOne({ _id: assignmentId, teacherId });
    if (!assignment) {
      return res.status(404).json({ message: 'Dolgozat nem található vagy nincs jogosultsága.' });
    }

    const students = await User.find({ 'assignments.assignmentId': assignmentId }).select('name className assignments');

    const submissions = students.map(student => {
      const submission = student.assignments.find(a => a.assignmentId.equals(assignmentId));
      if (!submission) return null;
      return {
        studentName: student.name,
        className: student.className || 'Nincs osztály',
        achievedPoints: submission.achievedPoints,
        totalPoints: assignment.totalPoints,
        suggestedGrade: submission.suggestedGrade,
        grade: submission.grade,
        completedAt: submission.completedAt,
      };
    }).filter(Boolean);

    if (submissions.length === 0) {
      return res.status(400).json({ message: 'Nincsenek beküldött dolgozatok az exportáláshoz.' });
    }

    // CSV generálása (BOM + pontosvessző elválasztóval a magyar Excelhez)
    let csvContent = '\uFEFF';
    csvContent += 'Diák neve;Osztály;Elért pont;Max pont;Százalék;Javasolt jegy;Beírt jegy;Beadási idő\n';

    submissions.forEach(sub => {
      const pct = assignment.totalPoints > 0 ? Math.round((sub.achievedPoints / assignment.totalPoints) * 100) : 0;
      const dateStr = sub.completedAt ? new Date(sub.completedAt).toLocaleString('hu-HU') : 'n/a';
      const gradeStr = sub.grade !== undefined && sub.grade !== null ? sub.grade : 'nincs beírva';
      
      const cleanName = sub.studentName.replace(/;/g, ' ');
      const cleanClass = sub.className.replace(/;/g, ' ');

      csvContent += `"${cleanName}";"${cleanClass}";${sub.achievedPoints};${sub.totalPoints};"${pct}%";${sub.suggestedGrade};"${gradeStr}";"${dateStr}"\n`;
    });

    const fileName = `${assignment.title.replace(/[\\/:*?"<>|]/g, '_')} - Eredmények.csv`;

    const mongoose = require('mongoose');
    const { GridFSBucket } = require('mongodb');
    const { Readable } = require('stream');
    const File = require('../models/File');

    if (!mongoose.connection.db) {
      throw new Error('Adatbázis kapcsolat nem aktív.');
    }
    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'documents'
    });

    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: 'text/csv'
    });

    const buffer = Buffer.from(csvContent, 'utf-8');
    const bufferStream = Readable.from(buffer);

    bufferStream.pipe(uploadStream)
      .on('error', (err) => {
        console.error('[CSV Export Stream Error]', err);
        return res.status(500).json({ message: 'Hiba a fájl mentése közben.' });
      })
      .on('finish', async () => {
        try {
          const fileDoc = new File({
            name: fileName,
            folder: null,
            user: teacherId,
            gridFSId: uploadStream.id,
            size: buffer.length,
            mimeType: 'text/csv'
          });

          await fileDoc.save();
          
          res.json({
            success: true,
            message: 'Eredmények sikeresen exportálva és elmentve a Dokumentumokba.',
            file: fileDoc
          });
        } catch (saveError) {
          console.error('[CSV File Metadata Save Error]', saveError);
          res.status(500).json({ message: 'Hiba történt a fájl mentésekor a Dokumentumok között.' });
        }
      });

  } catch (error) {
    console.error('[Export submissions error]', error);
    res.status(500).json({ message: 'Hiba az exportálás során.', error: error.message });
  }
});

// Tanár: pontszám felülírása
router.put('/teacher/override-score', authenticateTeacher, async (req, res) => {
  try {
    const { studentId, assignmentId, questionId, score } = req.body;
    if (studentId === undefined || !assignmentId || !questionId || score === undefined) {
      return res.status(400).json({ message: 'Hiányzó mezők.' });
    }
    const mongoose = require('mongoose');
    const aId = new mongoose.Types.ObjectId(assignmentId);
    const qId = new mongoose.Types.ObjectId(questionId);

    await User.updateOne(
      { _id: studentId },
      { $set: { 'assignments.$[a].answers.$[ans].score': Number(score) } },
      { arrayFilters: [{ 'a.assignmentId': aId }, { 'ans.questionId': qId }] }
    );

    // Újraszámol achievedPoints
    const student = await User.findById(studentId);
    const submission = student.assignments.find(a => a.assignmentId.equals(aId));
    if (submission) {
      const newAchievedPoints = submission.answers.reduce((sum, a) => sum + (a.score || 0), 0);
      await User.updateOne(
        { _id: studentId, 'assignments.assignmentId': aId },
        { $set: { 'assignments.$.achievedPoints': newAchievedPoints } }
      );
    }

    res.json({ message: 'Pontszám sikeresen frissítve.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a pontszám felülírásakor.' });
  }
});

// Diák: Közvetlen AI magyarázat (miért volt rossz a válasz)
router.post('/student/explain', authenticateStudent, async (req, res) => {
  try {
    const { questionText, correctAnswer, studentAnswer } = req.body;
    if (!questionText) return res.status(400).json({ message: 'questionText megadása kötelező.' });

    const formatAnswer = (ans) => {
      if (ans === null || ans === undefined) return '(nem válaszolt)';
      if (typeof ans === 'object') return JSON.stringify(ans, null, 2);
      return String(ans);
    };

    const systemPrompt = `Te egy segítőkész, empatikus általános iskolai tanár vagy magyarul.
A diák hibásan válaszolt egy kérdésre. Magyarázd el KÖZVETLENÜL és ÉRTHETŐEN, hogy:
1. Miért volt helytelen a diák válasza (1-2 mondat)
2. Mi a helyes válasz és miért (2-3 mondat)
Légy barátságos, bátorító és tömör. Maximum 5-6 mondatban válaszolj.
Kérdés: "${questionText}"
Helyes válasz: "${formatAnswer(correctAnswer)}"
A diák válasza: "${formatAnswer(studentAnswer)}"`;

    const explanation = await generateChatWithHistory(systemPrompt, []);
    res.json({ explanation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a magyarázat generálásakor.' });
  }
});

// Diák: Szókratészi AI tutor chat
router.post('/student/tutor', authenticateStudent, async (req, res) => {
  try {
    const { questionText, correctAnswer, studentAnswer, chatHistory } = req.body;
    if (!questionText || !studentAnswer) {
      return res.status(400).json({ message: 'questionText és studentAnswer megadása kötelező.' });
    }
    const systemPrompt = `Te egy türelmes, segítőkész általános iskolai tanár vagy magyarul.
A diák hibásan válaszolt egy kérdésre. A feladatod, hogy rávezető kérdésekkel segítsd megérteni a helyes választ.
TILOS közvetlenül megadnod a helyes választ. Tegyél fel 1-2 rövid, egyszerű rávezető kérdést.
Minden válaszod legyen magyarul és tömör (max 2-3 mondat).
Kérdés: "${questionText}"
A diák hibás válasza: "${studentAnswer}"`;

    const history = Array.isArray(chatHistory) ? chatHistory : [];
    const response = await generateChatWithHistory(systemPrompt, history);
    res.json({ response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a tutor válasz generálásakor.' });
  }
});

// Diák statisztikai adatok lekérése
router.get('/student/statistics', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.userId;

    const student = await User.findById(studentId).populate('assignments.assignmentId', 'title totalPoints subject');

    if (!student) {
      return res.status(404).json({ message: 'Diák nem található.' });
    }

    const validAssignments = student.assignments.filter(a => a.assignmentId != null);

    // Megírt (beküldött) és értékelt (jegyezett) dolgozatok száma
    const totalAssignments = validAssignments.length;
    const completedAssignments = validAssignments.filter(a => a.grade != null).length;

    // Átlagos pontszám kiszámítása (csak ahol van totalPoints)
    const totalAchievedPoints = validAssignments.reduce((sum, a) => sum + (a.achievedPoints || 0), 0);
    const totalPossiblePoints = validAssignments.reduce((sum, a) => sum + (a.assignmentId.totalPoints || 0), 0);
    const averageScore = totalPossiblePoints > 0
      ? Math.round((totalAchievedPoints / totalPossiblePoints) * 100)
      : 0;

    // Egyéni dolgozatok statisztikája
    const assignmentsStatistics = validAssignments.map(a => ({
      title: a.assignmentId.title,
      subject: a.assignmentId.subject,
      achievedPoints: a.achievedPoints,
      totalPoints: a.assignmentId.totalPoints,
      completedAt: a.completedAt,
      grade: a.grade ?? null,
    }));

    res.status(200).json({
      totalAssignments,
      completedAssignments,
      averageScore,
      assignmentsStatistics
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba történt a statisztikai adatok lekérdezése során.' });
  }
});

const mongoose = require('mongoose');
const TeacherChatHistory = require('../models/TeacherChatHistory');

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


// ─── Teacher Chat History ──────────────────────────────────────────────────

// GET /api/assignments/teacher/chat/history
router.get('/teacher/chat/history', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    let chatDoc = await TeacherChatHistory.findOne({ teacherId });
    if (!chatDoc) {
      return res.json({ messages: [], sessions: [], currentSessionId: null });
    }
    const session = chatDoc.getCurrentSession();
    const sessions = chatDoc.sessions
      .map(s => ({ sessionId: s.sessionId, title: s.title, updatedAt: s.updatedAt }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({
      messages: session ? session.messages : [],
      sessions,
      currentSessionId: chatDoc.currentSessionId
    });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a chat előzmények lekérésekor', error: err.message });
  }
});

// POST /api/assignments/teacher/chat/send
router.post('/teacher/chat/send', authenticateTeacher, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Üzenet megadása kötelező' });

    const teacherId = req.userId;
    const userObjectId = new mongoose.Types.ObjectId(teacherId);

    const [teacherAssignments, teacherClasses, teacherUser] = await Promise.all([
      Assignment.find({ teacherId: userObjectId }).lean(),
      Class.find({ teacherIds: userObjectId }).populate('studentIds', 'name className assignments').lean(),
      User.findById(userObjectId).select('-password').lean(),
    ]);

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

    const assignmentLines = teacherAssignments.length > 0
      ? teacherAssignments.map(a => {
          const studentCount = (a.studentIds || []).length;
          return `  - "${a.title}" | tantárgy: ${a.subject} | nehézség: ${a.difficulty} | teljesítette: ${a.completedCount || 0}/${studentCount} diák | max pont: ${a.totalPoints}`;
        }).join('\n')
      : '  Még nem hozott létre dolgozatot.';

    const systemPrompt = `Te a Feladify általános iskolai oktatási platform asszisztense vagy. Magyarul, magabiztosan és tömören válaszolj. A felhasználó egy tanár.

=== A TANÁR ADATAI (ezek tények, nem kell hozzájuk kétség) ===
Neve: ${teacherUser ? teacherUser.name : 'ismeretlen'}
Tantárgyai: ${(teacherUser?.subjects || []).join(', ') || 'nincs megadva'}

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

    let chatDoc = await TeacherChatHistory.findOne({ teacherId });
    if (!chatDoc) chatDoc = new TeacherChatHistory({ teacherId });

    chatDoc.addMessage('user', message);

    const allMessages = chatDoc.getRecentMessages(20);
    const historyMessages = allMessages.slice(0, -1);
    const messagesForAI = [
      ...historyMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    const streamMode = req.body.stream || req.query.stream === 'true';
    const modelOverride = req.body.modelOverride || null;

    if (streamMode) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      console.log('[Teacher Chat] Kezdődik a válasz streaming...');
      let fullResponse = '';

      for await (const chunk of aiService.generateResponseStream(systemPrompt, messagesForAI, { temperature: 0.75, max_tokens: 2048 }, true, modelOverride)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      const isErrorMsg = fullResponse.startsWith('Az AI szolgáltatás');
      if (fullResponse.trim() && !isErrorMsg) {
        chatDoc.addMessage('assistant', fullResponse);
        await chatDoc.save();
      }

      res.write(`data: ${JSON.stringify({ done: true, sessionId: chatDoc.currentSessionId })}\n\n`);
      res.end();
      return;
    }

    const aiResponse = await generateChatWithHistory(systemPrompt, messagesForAI);

    chatDoc.addMessage('assistant', aiResponse);
    await chatDoc.save();

    res.json({ message: aiResponse, sessionId: chatDoc.currentSessionId });
  } catch (err) {
    console.error('[Teacher Chat] Send error:', err.message);
    if (res.headersSent) return;
    const isAI = err.message?.includes('nem elérhető');
    res.status(isAI ? 503 : 500).json({ message: isAI ? err.message : 'Hiba az üzenet feldolgozásakor', aiUnavailable: isAI });
  }
});

// POST /api/assignments/teacher/chat/new-session
router.post('/teacher/chat/new-session', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    let chatDoc = await TeacherChatHistory.findOne({ teacherId });
    if (!chatDoc) chatDoc = new TeacherChatHistory({ teacherId });
    chatDoc.currentSessionId = null;
    await chatDoc.save();
    res.json({ message: 'Új session indítva' });
  } catch (err) {
    res.status(500).json({ message: 'Hiba az új session létrehozásakor', error: err.message });
  }
});

// POST /api/assignments/teacher/chat/load-session
router.post('/teacher/chat/load-session', authenticateTeacher, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'Session ID megadása kötelező' });

    const teacherId = req.userId;
    let chatDoc = await TeacherChatHistory.findOne({ teacherId });
    if (!chatDoc) return res.status(404).json({ message: 'Chat előzmények nem találhatók' });

    const session = chatDoc.sessions.find(s => s.sessionId === sessionId);
    if (!session) return res.status(404).json({ message: 'Session nem található' });

    chatDoc.currentSessionId = sessionId;
    await chatDoc.save();

    const sessions = chatDoc.sessions
      .map(s => ({ sessionId: s.sessionId, title: s.title, updatedAt: s.updatedAt }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ messages: session.messages, sessions });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a session betöltésekor', error: err.message });
  }
});

// DELETE /api/assignments/teacher/chat/session/:sessionId
router.delete('/teacher/chat/session/:sessionId', authenticateTeacher, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const teacherId = req.userId;

    let chatDoc = await TeacherChatHistory.findOne({ teacherId });
    if (!chatDoc) return res.status(404).json({ message: 'Chat előzmények nem találhatók' });

    const sessionIndex = chatDoc.sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) return res.status(404).json({ message: 'Session nem található' });

    chatDoc.sessions.splice(sessionIndex, 1);
    if (chatDoc.currentSessionId === sessionId) chatDoc.currentSessionId = null;
    await chatDoc.save();

    const sessions = chatDoc.sessions
      .map(s => ({ sessionId: s.sessionId, title: s.title, updatedAt: s.updatedAt }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ message: 'Session sikeresen törölve', sessions });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a session törlése során', error: err.message });
  }
});

// PUT /api/assignments/teacher/chat/session/:sessionId
router.put('/teacher/chat/session/:sessionId', authenticateTeacher, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const teacherId = req.userId;

    let chatDoc = await TeacherChatHistory.findOne({ teacherId });
    if (!chatDoc) return res.status(404).json({ message: 'Chat előzmények nem találhatók' });

    const session = chatDoc.sessions.find(s => s.sessionId === sessionId);
    if (!session) return res.status(404).json({ message: 'Session nem található' });

    session.title = title;
    session.updatedAt = new Date();
    await chatDoc.save();

    const sessions = chatDoc.sessions
      .map(s => ({ sessionId: s.sessionId, title: s.title, updatedAt: s.updatedAt }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ message: 'Session sikeresen átnevezve', sessions });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a session átnevezése során', error: err.message });
  }
});

// ─── Részletes statisztika: osztályonként, tantárgyanként, top/bottom diákok
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

// Tanár: osztályzat véglegesítése
router.put('/teacher/finalize-grade', authenticateTeacher, async (req, res) => {
  try {
    const { studentId, assignmentId, grade } = req.body;
    if (!studentId || !assignmentId || grade === undefined) {
      return res.status(400).json({ message: 'Hiányzó mezők.' });
    }

    await User.updateOne(
      { _id: studentId, 'assignments.assignmentId': assignmentId },
      { $set: { 'assignments.$.grade': Number(grade) } }
    );

    // Értesítés a diáknak és szüleinek
    Assignment.findById(assignmentId).select('title subject').then(async asgn => {
      notify(
        studentId,
        'assignment_graded',
        'Dolgozatod értékelve',
        `"${asgn?.title || 'Dolgozat'}" – Osztályzat: ${grade}`,
        { assignmentId, grade }
      );
      // Szülők értesítése
      const parents = await User.find({ role: 'parent', children: studentId }).select('_id').lean();
      const student = await User.findById(studentId).select('name').lean();
      for (const parent of parents) {
        notify(
          parent._id,
          'assignment_graded',
          'Gyermeked dolgozata értékelve',
          `${student?.name || 'Gyermeked'} – "${asgn?.title || 'Dolgozat'}" – Osztályzat: ${grade}`,
          { assignmentId, grade, studentId }
        );
      }
    }).catch(() => {});

    res.json({ message: 'Osztályzat sikeresen rögzítve.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba az osztályzat véglegesítésekor.' });
  }
});

// Tanár: reklamáció megválaszolása vagy elutasítása
router.put('/teacher/resolve-flag', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    const { studentId, assignmentId, questionId, response, rejected } = req.body;
    if (!studentId || !assignmentId || !questionId) {
      return res.status(400).json({ message: 'studentId, assignmentId és questionId megadása kötelező.' });
    }

    const assignment = await Assignment.findOne({ _id: assignmentId, teacherId });
    if (!assignment) return res.status(403).json({ message: 'Nincs jogosultsága ehhez a dolgozathoz.' });

    const aId = new mongoose.Types.ObjectId(assignmentId);
    const qId = new mongoose.Types.ObjectId(questionId);

    const updateFields = {};
    if (rejected) {
      updateFields['assignments.$[a].answers.$[ans].flagRejected'] = true;
      updateFields['assignments.$[a].answers.$[ans].flagResponse'] = '';
    } else {
      updateFields['assignments.$[a].answers.$[ans].flagResponse'] = response || '';
      updateFields['assignments.$[a].answers.$[ans].flagRejected'] = false;
    }

    const result = await User.updateOne(
      { _id: studentId },
      { $set: updateFields },
      { arrayFilters: [{ 'a.assignmentId': aId }, { 'ans.questionId': qId }] }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Válasz nem található.' });
    }

    // Diák értesítése
    const student = await User.findById(studentId).select('name');
    const question = assignment.questions?.find(q => q._id.equals(qId));
    const questionText = question?.questionText || 'kérdés';
    const notifMsg = rejected
      ? `A tanár elutasította a reklamációdat – "${assignment.title}" – "${questionText.substring(0, 50)}${questionText.length > 50 ? '…' : ''}"`
      : `A tanár válaszolt a reklamációdra – "${assignment.title}" – "${questionText.substring(0, 50)}${questionText.length > 50 ? '…' : ''}"`;
    await notify(studentId, 'assignment_graded', rejected ? 'Reklamáció elutasítva' : 'Tanár válaszolt a reklamációra', notifMsg, { assignmentId, questionId });

    res.json({ message: 'Reklamáció sikeresen kezelve.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a reklamáció kezelésekor.' });
  }
});

// Tanár: összes jelzett válasz lekérése a tanár dolgozataihoz
router.get('/teacher/flagged-answers', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    const assignments = await Assignment.find({ teacherId }).lean();
    if (assignments.length === 0) return res.json({ flaggedByAssignment: [] });

    const assignmentIds = assignments.map(a => a._id);
    const students = await User.find({
      'assignments.assignmentId': { $in: assignmentIds }
    }).select('name assignments').lean();

    const result = [];

    for (const assignment of assignments) {
      const flaggedSubmissions = [];

      for (const student of students) {
        const submission = student.assignments?.find(a => String(a.assignmentId) === String(assignment._id));
        if (!submission) continue;

        const flaggedAnswers = submission.answers?.filter(ans => ans.flagged) || [];
        if (flaggedAnswers.length === 0) continue;

        flaggedSubmissions.push({
          studentId: student._id,
          studentName: student.name,
          flaggedAnswers: flaggedAnswers.map(ans => {
            const question = assignment.questions?.find(q => String(q._id) === String(ans.questionId));
            return {
              questionId: ans.questionId,
              questionText: question?.questionText || '',
              questionType: question?.questionType || 'short_answer',
              studentAnswer: ans.studentAnswer,
              correctAnswer: question?.correctAnswer ?? null,
              score: ans.score,
              maxPoints: question?.points ?? 1,
              flagResponse: ans.flagResponse || '',
              flagRejected: ans.flagRejected ?? false,
            };
          }),
        });
      }

      if (flaggedSubmissions.length > 0) {
        result.push({
          assignmentId: assignment._id,
          assignmentTitle: assignment.title,
          subject: assignment.subject,
          flaggedSubmissions,
        });
      }
    }

    res.json({ flaggedByAssignment: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a jelzett válaszok lekérésekor.' });
  }
});

// Tanár: kérdés szerkesztése egy már mentett dolgozatban
router.put('/teacher/update-question', authenticateTeacher, async (req, res) => {
  try {
    const teacherId = req.userId;
    const { assignmentId, questionId, questionText, options, pairs, items, correctAnswer, points } = req.body;
    if (!assignmentId || !questionId) {
      return res.status(400).json({ message: 'assignmentId és questionId megadása kötelező.' });
    }

    const assignment = await Assignment.findOne({ _id: assignmentId, teacherId });
    if (!assignment) return res.status(403).json({ message: 'Nincs jogosultsága ehhez a dolgozathoz.' });

    const qId = new mongoose.Types.ObjectId(questionId);
    const question = assignment.questions.id(qId);
    if (!question) return res.status(404).json({ message: 'Kérdés nem található.' });

    if (questionText !== undefined) question.questionText = questionText;
    if (options !== undefined) question.options = options;
    if (pairs !== undefined) question.pairs = pairs;
    if (items !== undefined) question.items = items;
    if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;
    if (points !== undefined) {
      const newPoints = Math.max(1, Number(points));
      const oldPoints = question.points || 1;
      question.points = newPoints;
      assignment.totalPoints = (assignment.totalPoints || 0) - oldPoints + newPoints;
    }

    await assignment.save();
    res.json({ message: 'Kérdés sikeresen frissítve.', question: question.toObject() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Hiba a kérdés frissítésekor.' });
  }
});

module.exports = router;
