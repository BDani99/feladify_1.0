const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProgress = require('../models/StudentProgress');
const StudentChatHistory = require('../models/StudentChatHistory');
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const DiagnosticTest = require('../models/DiagnosticTest');
const DiagnosticResult = require('../models/DiagnosticResult');
const groqService = require('../services/groqService');

// Middleware to verify JWT token and get user
const authMiddleware = async (req, res, next) => {
  console.log('[Student API] Auth middleware for:', req.path);
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('[Student API] No token provided');
      return res.status(401).json({ message: 'Nincs jogosultság - nincs token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'student') {
      return res.status(403).json({ message: 'Csak diákok férhetnek hozzá' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Student API] Auth error:', error.message);
    res.status(401).json({ message: 'Érvényes token szükséges' });
  }
};

// GET /api/student/roadmap - Diák útvonalának lekérése (LEGACY - meghagyva kompatibilitás miatt)
router.get('/roadmap', authMiddleware, async (req, res) => {
  try {
    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) {
      progress = new StudentProgress({
        studentId: req.user._id,
        roadmap: generateInitialRoadmap(req.user.className)
      });
      await progress.save();
    }
    progress.updateStreak();
    await progress.save();

    res.json({
      totalXP: progress.totalXP,
      streak: progress.streak,
      badges: progress.badges,
      roadmap: progress.roadmap,
      dailyGoal: progress.dailyGoal,
      weeklyGoal: progress.weeklyGoal
    });
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt az útvonal lekérésekor', error: error.message });
  }
});

// POST /api/student/roadmap/submit - Szintfelmérő beküldése (LEGACY)
router.post('/roadmap/submit', authMiddleware, async (req, res) => {
  try {
    const { nodeId, score, answers } = req.body;
    if (!nodeId || score === undefined) return res.status(400).json({ message: 'Hiányos adatok' });

    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) return res.status(404).json({ message: 'Nem található előrehaladás' });

    const node = progress.roadmap.id(nodeId);
    if (!node) return res.status(404).json({ message: 'Node nem található' });

    node.score = score;
    node.status = 'completed';
    node.completedAt = new Date();
    node.attempts += 1;

    progress.addXP(50 + Math.floor(score * 0.5) + (node.attempts === 1 ? 25 : 0));

    if (score > 90) {
      const currentIndex = progress.roadmap.findIndex(n => n.nodeId === nodeId);
      for (let i = 1; i <= 2; i++) {
        const nextNode = progress.roadmap[currentIndex + i];
        if (nextNode && !nextNode.isExtraPractice) nextNode.status = 'unlocked';
      }
    }
    if (score < 60) {
      const currentNode = progress.roadmap.find(n => n.nodeId === nodeId);
      const extraNodes = generateExtraPracticeNodes(currentNode.subject, nodeId);
      progress.roadmap.push(...extraNodes);
    }

    const newBadges = progress.checkBadges();
    await progress.save();

    res.json({ message: 'Sikeresen beküldve', xpEarned: 50, newBadges, totalXP: progress.totalXP, streak: progress.streak });
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt a beküldéskor', error: error.message });
  }
});

// GET /api/student/practice - Egyéni gyakorlás útvonalának lekérése (ÚJ LOGIKA)
router.get('/practice', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /practice - User:', req.user._id, 'Subject:', req.query.subject);
  try {
    const subject = req.query.subject;
    if (!subject) {
      return res.status(400).json({ message: 'Tantárgy szükséges' });
    }

    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) {
      progress = new StudentProgress({ studentId: req.user._id, subjectProgress: [] });
    }

    let subjectData = progress.subjectProgress.find(item => item.subject === subject);
    
    // Ha még sosem kezdte el az adott tantárgyat
    if (!subjectData) {
      subjectData = {
        subject: subject,
        currentLevel: 1,
        status: 'requires_diagnostic',
        checkpoints: []
      };
      progress.subjectProgress.push(subjectData);
      await progress.save();
      // Frissítjük a referenciát
      subjectData = progress.subjectProgress.find(item => item.subject === subject);
    }

    res.json(subjectData);
  } catch (error) {
    console.error('[Student API] Error in /practice:', error);
    res.status(500).json({ message: 'Hiba történt a gyakorlási út lekérésekor', error: error.message });
  }
});

// POST /api/student/practice/submit - Checkpoint eredményének beküldése (ÚJ LOGIKA)
router.post('/practice/submit', authMiddleware, async (req, res) => {
  console.log('[Student API] POST /practice/submit - User:', req.user._id);
  try {
    const { subject, checkpointId, score, answers } = req.body;
    if (!subject || !checkpointId || score === undefined) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) return res.status(404).json({ message: 'Nem található előrehaladás' });

    const subjectData = progress.subjectProgress.find(item => item.subject === subject);
    if (!subjectData) return res.status(404).json({ message: 'Nem található gyakorlási út a tantárgyhoz' });

    const checkpoint = subjectData.checkpoints.find(c => c.checkpointId === checkpointId || c._id?.toString() === checkpointId);
    if (!checkpoint) return res.status(404).json({ message: 'Checkpoint nem található' });

    checkpoint.score = Math.min(Math.max(score, 0), 100);
    checkpoint.status = 'completed'; // Mivel befejezte a modált, teljesítettnek vesszük
    checkpoint.attempts = (checkpoint.attempts || 0) + 1;
    checkpoint.completedAt = new Date();

    // Feloldjuk a következőt
    const currentIndex = subjectData.checkpoints.findIndex(c => c.checkpointId === checkpointId || c._id?.toString() === checkpointId);
    if (currentIndex !== -1 && currentIndex < subjectData.checkpoints.length - 1) {
      const nextCheckpoint = subjectData.checkpoints[currentIndex + 1];
      if (nextCheckpoint && nextCheckpoint.status === 'locked') {
        nextCheckpoint.status = 'unlocked';
      }
    }

    // XP kiszámítása
    const baseXP = 30;
    const bonus = Math.round(score * 0.5);
    const xpEarned = baseXP + bonus;
    progress.addXP(xpEarned);

    // Szint ellenőrzése
    const allCompleted = subjectData.checkpoints.every(c => c.status === 'completed');
    if (allCompleted && subjectData.checkpoints.length > 0) {
      subjectData.status = 'level_complete'; // A frontend ezt várja az új szintfelmérő gombhoz!
      progress.addXP(100); // Bónusz a szintért
    } else {
      subjectData.status = 'in_progress';
    }
    subjectData.lastUpdated = new Date();

    const newBadges = progress.checkBadges();
    await progress.save();

    res.json({
      message: 'Kihívás sikeresen mentve',
      xpEarned,
      totalXP: progress.totalXP,
      streak: progress.streak,
      newBadges,
      subjectProgress: subjectData
    });
  } catch (error) {
    console.error('[Student API] Error in /practice/submit:', error);
    res.status(500).json({ message: 'Hiba történt a feladat mentésekor', error: error.message });
  }
});

// POST /api/student/tutor/question-set - több kérdés generálása a gyakorláshoz
router.post('/tutor/question-set', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, difficulty, count } = req.body;
    if (!subject || !topic) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    const questions = await groqService.generatePracticeQuestionSet(subject, topic, difficulty || 3, count || 3);
    res.json({ questions });
  } catch (error) {
    console.error('[Student API] Error in /tutor/question-set:', error);
    res.status(500).json({ message: 'Hiba történt a kérdéssor generálásakor', error: error.message });
  }
});

// ==================== DIAGNOSZTIKAI TESZT VÉGPONTOK ====================

router.get('/diagnostic/start/:subject', authMiddleware, async (req, res) => {
  try {
    const { subject } = req.params;
    const validSubjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    if (!validSubjects.includes(subject)) return res.status(400).json({ message: 'Érvénytelen tantárgy' });

    const inProgressTest = await DiagnosticResult.findOne({
      studentId: req.user._id,
      subject,
      status: 'in_progress'
    });

    if (inProgressTest) {
      const questions = await DiagnosticTest.find({ _id: { $in: inProgressTest.answers.map(a => a.questionId) } });
      return res.json({ testId: inProgressTest._id, questions, resumed: true, totalQuestions: 20 });
    }

    const questions = await DiagnosticTest.generateDiagnosticTest(subject, 20);
    
    if (questions.length < 20) {
      const additionalQuestions = await DiagnosticTest.find({ subject }).sort({ difficulty: 1 }).limit(20 - questions.length);
      const existingIds = questions.map(q => q._id.toString());
      const newQuestions = additionalQuestions.filter(q => !existingIds.includes(q._id.toString()));
      questions.push(...newQuestions);
    }

    if (questions.length === 0) {
       return res.status(404).json({ message: 'Nincsenek kérdések ehhez a tantárgyhoz.' });
    }

    const result = await DiagnosticResult.startDiagnosticTest(req.user._id, subject, questions[0]._id);
    result.testId = questions[0]._id;
    await result.save();

    const shuffledQuestions = questions.sort(() => Math.random() - 0.5).slice(0, 20);

    res.json({ testId: result._id, questions: shuffledQuestions, totalQuestions: 20, subject });
  } catch (error) {
    console.error('[Student API] Error in /diagnostic/start:', error);
    res.status(500).json({ message: 'Hiba történt a teszt indításakor', error: error.message });
  }
});

// POST /api/student/diagnostic/submit - Diagnosztikai teszt válaszainak beküldése
router.post('/diagnostic/submit', authMiddleware, async (req, res) => {
  try {
    const { testId, answers } = req.body;
    if (!testId || !answers || !Array.isArray(answers)) return res.status(400).json({ message: 'Hiányos adatok' });

    const result = await DiagnosticResult.findById(testId);
    if (!result) return res.status(404).json({ message: 'Teszt nem található' });
    if (result.studentId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Nincs jogosultság' });
    if (result.status !== 'in_progress') return res.status(400).json({ message: 'A teszt már be lett küldve' });

    const questionIds = answers.map(a => a.questionId);
    const questions = await DiagnosticTest.find({ _id: { $in: questionIds } });

    const evaluatedAnswers = answers.map(answer => {
      const question = questions.find(q => q._id.toString() === answer.questionId);
      if (!question) return null;

      let isCorrect = false;
      let points = 0;

      switch (question.questionType) {
        case 'multiple_choice':
        case 'true_false':
          isCorrect = answer.answer === question.correctAnswer;
          points = isCorrect ? question.points : 0;
          break;
        case 'short_answer':
          const studentAnswer = answer.answer.toLowerCase().trim();
          const correctAnswer = question.correctAnswer.toLowerCase().trim();
          isCorrect = studentAnswer === correctAnswer || studentAnswer.includes(correctAnswer);
          points = isCorrect ? question.points : 0;
          break;
        case 'matching':
          const studentPairs = answer.answer;
          const correctPairs = question.correctAnswer;
          const correctMatches = studentPairs.filter(pair => {
            return correctPairs.some(cp => cp.left === pair.left && cp.right === pair.right);
          });
          isCorrect = correctMatches.length === correctPairs.length;
          points = (correctMatches.length / correctPairs.length) * question.points;
          break;
      }

      return { questionId: question._id, studentAnswer: answer.answer, isCorrect, points, timeSpent: answer.timeSpent || 0 };
    }).filter(a => a !== null);

    evaluatedAnswers.forEach(answer => {
      result.addAnswer(answer.questionId, answer.studentAnswer, answer.isCorrect, answer.points, answer.timeSpent);
    });

    result.completeTest();
    
    // AI Elemzés (itt generálja le a GroqService a gyengeségeket/erősségeket)
    const analyzedResult = await DiagnosticResult.analyzeResults(result._id);

    // Készítsük el / Frissítsük a gyakorlóutat az AI elemzés alapján!
    await createOrUpdatePracticePath(req.user._id, analyzedResult, result.subject);

    res.json({
      message: 'Sikeresen beküldve',
      resultId: result._id,
      score: result.scorePercentage,
      categoryAnalysis: analyzedResult.categoryAnalysis,
      aiAnalysis: analyzedResult.aiAnalysis
    });
  } catch (error) {
    console.error('[Student API] Error in /diagnostic/submit:', error);
    res.status(500).json({ message: 'Hiba történt a beküldéskor', error: error.message });
  }
});

// ==================== TOVÁBBI TUTOR & STAT ENDPOINTOK ====================

router.post('/tutor/hint', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber, tone } = req.body;
    if (!subject || !topic || !questionText || !studentAnswer || !correctAnswer) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }
    const hint = await groqService.generateSocraticHint(subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber || 1, tone || 'teacher');
    res.json({ hint });
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt a tipp generálásakor', error: error.message });
  }
});

// A régi /tutor/question kompatibilitás miatt, hívja a Set-et count=1-gyel
router.post('/tutor/question', authMiddleware, async (req, res) => {
  try {
    const { subject, topic } = req.body;
    const questionsSet = await groqService.generatePracticeQuestionSet(subject, topic, 3, 1);
    res.json(questionsSet[0] || {});
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt a kérdés generálásakor', error: error.message });
  }
});

router.post('/tutor/check', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, questionText, questionType, studentAnswer, correctAnswer, attemptNumber, tone } = req.body;
    
    let isCorrect = false;
    if (questionType === 'shorttext') {
      const result = await groqService.checkShortTextAnswer(subject, questionText, studentAnswer, correctAnswer);
      isCorrect = result.correct;
    } else {
      const norm = (s) => String(s).toLowerCase().trim().replace(/[.,!?]/g, '');
      isCorrect = norm(studentAnswer) === norm(correctAnswer);
    }

    if (isCorrect) {
      return res.json({ correct: true, message: 'Helyes válasz! Szép munka, lépjünk is tovább! 🎉' });
    } else {
      const hint = await groqService.generateSocraticHint(subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber || 1, tone || 'teacher');
      return res.json({ correct: false, hint });
    }
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt az ellenőrzés során', error: error.message });
  }
});

router.get('/diagnostic/statuses', authMiddleware, async (req, res) => {
  try {
    const subjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    const statuses = {};

    for (const subject of subjects) {
      const result = await DiagnosticResult.findOne({ studentId: req.user._id, subject }).sort({ completedAt: -1 });
      if (result) {
        statuses[subject] = { status: result.status === 'in_progress' ? 'in_progress' : 'completed' };
      } else {
        statuses[subject] = { status: 'not_started' };
      }
    }
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt a státuszok lekérésekor', error: error.message });
  }
});

// ==================== SEGÉDFÜGGVÉNYEK (ÚJRAÍRVA) ====================

// Ez hívódik meg, miután befejezte a diák a tesztet
async function createOrUpdatePracticePath(studentId, analyzedResultDoc, subjectName) {
  let progress = await StudentProgress.findOne({ studentId });
  if (!progress) {
    progress = new StudentProgress({ studentId, subjectProgress: [] });
  }

  const subject = subjectName || analyzedResultDoc.subject;
  let subjectData = progress.subjectProgress.find(item => item.subject === subject);
  
  if (!subjectData) {
    progress.subjectProgress.push({
      subject,
      currentLevel: 1,
      status: 'in_progress',
      checkpoints: []
    });
    subjectData = progress.subjectProgress.find(item => item.subject === subject);
  } else {
    // Ha megcsinálta az ÚJ szintfelmérőt egy kész szint után, lépjen szintet!
    if (subjectData.status === 'level_complete') {
      subjectData.currentLevel += 1;
    }
    subjectData.status = 'in_progress';
  }

  // Építjük fel a checkpointokat az AI elemzés alapján
  const aiAnalysis = analyzedResultDoc.aiAnalysis || {};
  const recommended = aiAnalysis.recommendedCheckpoints || [];
  
  const checkpoints = [];
  
  if (recommended.length > 0) {
    recommended.forEach((rec, index) => {
      checkpoints.push({
        checkpointId: `chk_${Date.now()}_${index}`,
        topic: rec.topic || 'Gyakorló feladat',
        difficulty: rec.difficulty || 3,
        status: index === 0 ? 'unlocked' : 'locked',
        score: 0,
        attempts: 0
      });
    });
  } else {
    // Biztonsági fallback, ha a Groq véletlen nem adott volna rendes tömböt
    checkpoints.push({ checkpointId: `chk_${Date.now()}_0`, topic: 'Alapok ismétlése', difficulty: 2, status: 'unlocked', score: 0, attempts: 0 });
    checkpoints.push({ checkpointId: `chk_${Date.now()}_1`, topic: 'Gyakorlás', difficulty: 3, status: 'locked', score: 0, attempts: 0 });
    checkpoints.push({ checkpointId: `chk_${Date.now()}_2`, topic: 'Kihívás', difficulty: 4, status: 'locked', score: 0, attempts: 0 });
  }

  subjectData.checkpoints = checkpoints;
  subjectData.lastUpdated = new Date();

  await progress.save();
  console.log('[Student API] Practice path successfully generated from Diagnostic Result.');
  return progress;
}

// (Legacy segédfüggvények meghagyva, ha valami régi kód még hivatkozna rájuk)
function generateInitialRoadmap(className) {
  return []; // Üresen hagyva, az új logika már a practicePath-et használja
}
function generateExtraPracticeNodes(subject, parentNodeId) {
  return [];
}

module.exports = router;