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

// GET /api/student/progress - Összes tantárgy progessz lekérése
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) {
      progress = new StudentProgress({ studentId: req.user._id, subjectProgress: [] });
      await progress.save();
    }

    // Biztosítjuk, hogy minden tantárgy létezik
    const validSubjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    for (const subject of validSubjects) {
      if (!progress.subjectProgress.find(sp => sp.subject === subject)) {
        progress.subjectProgress.push({
          subject,
          currentLevel: 1,
          status: 'not_started',
          percentage: 0,
          checkpoints: []
        });
      }
    }
    await progress.save();

    res.json({
      progress: progress.subjectProgress,
      totalXP: progress.totalXP,
      streak: progress.streak
    });
  } catch (error) {
    console.error('[Student API] Error in /progress:', error);
    res.status(500).json({ message: 'Hiba a progress lekérésekor', error: error.message });
  }
});

// GET /api/student/progress/:subject - Tantárgyi progress lekérése
router.get('/progress/:subject', authMiddleware, async (req, res) => {
  try {
    const { subject } = req.params;
    const validSubjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    if (!validSubjects.includes(subject)) {
      return res.status(400).json({ message: 'Érvénytelen tantárgy' });
    }

    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) {
      progress = new StudentProgress({ studentId: req.user._id, subjectProgress: [] });
      await progress.save();
    }

    let subjectData = progress.subjectProgress.find(item => item.subject === subject);

    if (!subjectData) {
      subjectData = {
        subject: subject,
        currentLevel: 1,
        status: 'not_started',
        percentage: 0,
        checkpoints: []
      };
      progress.subjectProgress.push(subjectData);
      await progress.save();
      subjectData = progress.subjectProgress.find(item => item.subject === subject);
    }

    res.json({
      ...subjectData.toObject ? subjectData.toObject() : subjectData,
      totalXP: progress.totalXP,
      streak: progress.streak
    });
  } catch (error) {
    console.error('[Student API] Error in /progress/:subject:', error);
    res.status(500).json({ message: 'Hiba a progress lekérésekor', error: error.message });
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

// POST /api/student/diagnostic/start - Diagnosztikai teszt indítása (új route)
router.post('/diagnostic/start', authMiddleware, async (req, res) => {
  try {
    const { subject } = req.body;
    const validSubjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    if (!subject || !validSubjects.includes(subject)) {
      return res.status(400).json({ message: 'Érvénytelen vagy hiányzó tantárgy' });
    }

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
    console.error('[Student API] Error in POST /diagnostic/start:', error);
    res.status(500).json({ message: 'Hiba történt a teszt indításakor', error: error.message });
  }
});

// GET /api/student/diagnostic/start/:subject - Diagnosztikai teszt indítása (legacy route)
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

// GET /api/student/chat/history
router.get('/chat/history', authMiddleware, async (req, res) => {
  try {
    let chatDoc = await StudentChatHistory.findOne({ studentId: req.user._id });
    if (!chatDoc) {
      return res.json({ messages: [], sessions: [], currentSessionId: null });
    }
    const session = chatDoc.getCurrentSession();
    const sessions = chatDoc.sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      updatedAt: s.updatedAt
    }));
    res.json({
      messages: session ? session.messages : [],
      sessions,
      currentSessionId: chatDoc.currentSessionId
    });
  } catch (err) {
    console.error('[Student API] Chat history error:', err.message);
    res.status(500).json({ message: 'Hiba a chat előzmények lekérésekor', error: err.message });
  }
});

// POST /api/student/chat/send
router.post('/chat/send', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    console.log('[Student API] Chat send - Üzenet:', message.substring(0, 50) + '...');

    if (!message) {
      return res.status(400).json({ message: 'Üzenet megadása kötelező' });
    }

    // Szűrés: csak tanulási kérdéseket engedélyezni
    const nonEducationalPatterns = [
      /vicc/i, /meme/i, /függetlenség/, /política/i, /politika/i,
      /ételrezept/i, /játék.*letöltés/i, /film.*nézés/i, /zene/i,
      /szerelem/i, /barátság/i, /kedvenc/i, /hobbi/i, /szórakozás/i
    ];

    const isNonEducational = nonEducationalPatterns.some(p => p.test(message));
    console.log('[Student API] Chat send - Tanulási kérdés?', !isNonEducational);

    if (isNonEducational) {
      return res.json({
        message: `Elnézést, de csak tanulással kapcsolatos kérdésekre tudok válaszolni! 📚 Kérlek, kérdezz valamit a tantárgyaidról, és szívesen segítek.`,
        sessionId: null
      });
    }

    let chatDoc = await StudentChatHistory.findOne({ studentId: req.user._id });
    if (!chatDoc) {
      chatDoc = new StudentChatHistory({ studentId: req.user._id });
      console.log('[Student API] Chat send - Új chat doc létrehozva');
    }

    console.log('[Student API] Chat send - Jelenlegi session ID:', chatDoc.currentSessionId);
    chatDoc.addMessage('user', message);
    console.log('[Student API] Chat send - Session ID után:', chatDoc.currentSessionId);

    const student = await User.findById(req.user._id).select('-password');
    const progress = await StudentProgress.findOne({ studentId: req.user._id });

    console.log('[Student API] Chat send - Diák:', student.name, 'Osztály:', student.className);

    // Begyűjtjük a diák haladási adatait
    let weaknesses = [];
    let strengths = [];
    if (progress && progress.subjectProgress) {
      progress.subjectProgress.forEach(sp => {
        if (sp.status === 'requires_diagnostic') {
          weaknesses.push(sp.subject + ' – még nincs felmérve');
        } else if (sp.currentLevel && sp.currentLevel >= 3) {
          strengths.push(sp.subject);
        }
      });
    }

    // Előző/függőben lévő dolgozatok lekérése
    const assignments = await Assignment.find({
      submittedBy: req.user._id,
      submissionStatus: { $ne: 'graded' }
    }).limit(5);

    let assignmentInfo = 'Nincsenek függőben lévő dolgozatok';
    if (assignments.length > 0) {
      assignmentInfo = assignments.map(a => `${a.title} (${a.dueDate ? new Date(a.dueDate).toLocaleDateString('hu-HU') : 'nincs határidő'})`).join(', ');
    }

    console.log('[Student API] Chat send - Erős területek:', strengths.length, 'Gyenge területek:', weaknesses.length);

    // Speciális kezelés a gyakori kérdésekre
    let enhancedPrompt = message.toLowerCase();
    let specialContext = '';

    if (enhancedPrompt.includes('dolgozat') && enhancedPrompt.includes('héten')) {
      specialContext = `\n\n[SPECIÁLIS KÉRÉS: A diák az aktuális heti dolgozatairól kérdez. Az alábbi dolgozatok az ő dolgozatai: ${assignmentInfo}]`;
    } else if (enhancedPrompt.includes('kérdezz ki') && enhancedPrompt.includes('gyengébb')) {
      specialContext = `\n\n[SPECIÁLIS KÉRÉS: A diák arra kéri, hogy kérdezzél ki a gyenge területeiről. Gyenge területek: ${weaknesses.join(', ') || 'még ismeretlen'}. Hozz létre egy rövid, kérdésből álló kvízt!]`;
    } else if (enhancedPrompt.includes('javít') && enhancedPrompt.includes('átlag')) {
      specialContext = `\n\n[SPECIÁLIS KÉRÉS: A diák a tanulmányi eredményeinek javítását szeretné. Adj konkrét, megvalósítható tanácsokat a tanulási szokásokra.]`;
    } else if (enhancedPrompt.includes('magyarázd el')) {
      specialContext = `\n\n[SPECIÁLIS KÉRÉS: A diák egy téma magyarázatát szeretné. Kezd egyszerűen, majd fokozatosan menj mélyebbre. Kérdéseket is tegyen fel, hogy ellenőrizze a megértést.]`;
    }

    const today = new Date().toLocaleDateString('hu-HU', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const systemPrompt = `Te a Feladify AI Tanulótársa vagy – ${student.name} (${student.className || 'ismeretlen osztály'}) személyes asszisztense.

Diák profil:
- Tantárgyak: ${student.subjects && student.subjects.length > 0 ? student.subjects.join(', ') : 'nem megadott'}
- Erős területek: ${strengths.length > 0 ? strengths.join(', ') : 'még nem mérhető'}
- Fejlesztendő: ${weaknesses.length > 0 ? weaknesses.join(', ') : 'nem jelezve'}
- Összesített XP: ${progress ? progress.totalXP : 0}
- Tanulási streak: ${progress ? progress.streak : 0} nap
- Függőben lévő dolgozatok: ${assignmentInfo}
- Mai dátum: ${today}

FONTOS SZABÁLYOK:
1. Elsősorban tanulással és tantárgyakkal kapcsolatos kérdésekre válaszolj
2. Barátságos, bátorító, KONKRÉT, RÉSZLETES magyar válaszok (NEM generic felvezetés!)
3. Ha a diák köszön (pl. "Szia", "Helló", "Jó reggelt"), köszönj vissza barátságosan, majd ajánlj segítséget a tanuláshoz
4. Egyszerű általános kérdésekre (pl. "Milyen nap van ma?", "Hogy vagy?") röviden, barátságosan válaszolj
5. Egyértelműen nem tanulással kapcsolatos témáknál (szórakozás, filmek, zene, játékok): "Elnézést, de csak tanulással kapcsolatos kérdésekre tudok válaszolni! 📚"
6. Személyre szabva válaszolj a diák szintjéhez és szükségleteihez
7. Soha ne magyarázz meg mindent – kérdésekkel segíts rájönni (Szókratikus módszer)
8. KONKRÉT válaszok: Ha dolgozatokról kérdez → felsorolj; Ha magyarázatra kérdez → kezdj azonnal
9. Proaktív: tanácsok, motiváció, konkrét lépések${specialContext}`;

    // Készítsd elő a histrória üzeneteit (korábbi beszélgetés, az aktuális üzenet nélkül)
    const allMessages = chatDoc.getRecentMessages(20);
    const historyMessages = allMessages.slice(0, -1); // az utolsó üzenet (current user message) nélkül

    // Az aktuális üzenetet mint "user" role-ban adjuk a kontextushoz
    const messagesForAI = [
      ...historyMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    console.log('[Student API] Chat send - História üzenetei:', historyMessages.length, 'aktuális üzenet hozzáadva');
    if (specialContext) {
      console.log('[Student API] Chat send - Speciális kezelés aktiválva');
    }

    console.log('[Student API] Chat send - Groq API hívása előtt');
    const aiResponse = await groqService.generateResponse(systemPrompt, messagesForAI, { temperature: 0.75, max_tokens: 512 });
    console.log('[Student API] Chat send - AI válasz hossza:', aiResponse.length, 'Első 100 char:', aiResponse.substring(0, 100));

    chatDoc.addMessage('assistant', aiResponse);
    await chatDoc.save();

    res.json({ message: aiResponse, sessionId: chatDoc.currentSessionId });
  } catch (err) {
    console.error('[Student API] Chat send error:', err.message);
    console.error('[Student API] Chat send error stack:', err.stack);
    res.status(500).json({ message: 'Hiba az üzenet feldolgozásakor', error: err.message });
  }
});

// POST /api/student/chat/new-session
router.post('/chat/new-session', authMiddleware, async (req, res) => {
  try {
    let chatDoc = await StudentChatHistory.findOne({ studentId: req.user._id });
    if (!chatDoc) {
      chatDoc = new StudentChatHistory({ studentId: req.user._id });
    }
    chatDoc.currentSessionId = null;
    await chatDoc.save();
    res.json({ message: 'Új session indítva' });
  } catch (err) {
    console.error('[Student API] New session error:', err.message);
    res.status(500).json({ message: 'Hiba az új session létrehozásakor', error: err.message });
  }
});

// POST /api/student/chat/load-session
router.post('/chat/load-session', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID megadása kötelező' });
    }

    let chatDoc = await StudentChatHistory.findOne({ studentId: req.user._id });
    if (!chatDoc) {
      return res.status(404).json({ message: 'Chat előzmények nem találhatók' });
    }

    const session = chatDoc.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session nem található' });
    }

    chatDoc.currentSessionId = sessionId;
    await chatDoc.save();

    const sessions = chatDoc.sessions.map(s => ({
      sessionId: s.sessionId,
      title: s.title,
      updatedAt: s.updatedAt
    }));

    res.json({
      messages: session.messages,
      sessions
    });
  } catch (err) {
    console.error('[Student API] Load session error:', err.message);
    res.status(500).json({ message: 'Hiba a session betöltésekor', error: err.message });
  }
});

// ==================== CHECKPOINT ROUTE-OK ====================

// POST /api/student/checkpoint/start - Checkpoint megkezdése
router.post('/checkpoint/start', authMiddleware, async (req, res) => {
  try {
    const { subject, checkpointId } = req.body;
    if (!subject || !checkpointId) {
      return res.status(400).json({ message: 'Tantárgy és checkpoint ID szükséges' });
    }

    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) return res.status(404).json({ message: 'Progress nem található' });

    const subjectData = progress.subjectProgress.find(s => s.subject === subject);
    if (!subjectData) return res.status(404).json({ message: 'Tantárgy nem található' });

    const checkpoint = subjectData.checkpoints.find(c => c.checkpointId === checkpointId);
    if (!checkpoint) return res.status(404).json({ message: 'Checkpoint nem található' });

    // Kérdéssor generálása az AI-val
    const questions = await groqService.generatePracticeQuestionSet(subject, checkpoint.topic, 3, 10);

    res.json({
      checkpointId,
      checkpointTitle: checkpoint.topic,
      questions: questions || [],
      difficulty: checkpoint.difficulty
    });
  } catch (error) {
    console.error('[Student API] Error in checkpoint/start:', error);
    res.status(500).json({ message: 'Hiba a checkpoint indításakor', error: error.message });
  }
});

// POST /api/student/checkpoint/answer - Válasz ellenőrzése
router.post('/checkpoint/answer', authMiddleware, async (req, res) => {
  try {
    const { checkpointId, questionId, answer, subject } = req.body;
    if (!checkpointId || !questionId || !answer) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    // Egyszerű logika: AI-val ellenőrizni kellene, de fallback
    const isCorrect = Math.random() > 0.3; // Temp: 70% success rate
    const aiMessage = isCorrect
      ? `Helyes! Jó gondolkodás. ${subject} kérdésekben ez a megközelítés helytelen. Gondold végig, mi lehet a kapcsolat...`
      : `Érdekes válasz. Ez nem egészen helyes. Gondolj arra, hogy milyen más lehetőségek vannak...`;

    res.json({
      isCorrect,
      aiMessage,
      hint: 'Gondolj a legalapvetőbb fogalmakra.',
      currentScore: {
        correct: 1,
        total: 10,
        xpEarned: isCorrect ? 10 : 0
      }
    });
  } catch (error) {
    console.error('[Student API] Error in checkpoint/answer:', error);
    res.status(500).json({ message: 'Hiba az ellenőrzéskor', error: error.message });
  }
});

// POST /api/student/checkpoint/complete - Checkpoint lezárása
router.post('/checkpoint/complete', authMiddleware, async (req, res) => {
  try {
    const { checkpointId, subject, answers } = req.body;
    if (!checkpointId || !subject) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) return res.status(404).json({ message: 'Progress nem található' });

    const subjectData = progress.subjectProgress.find(s => s.subject === subject);
    if (!subjectData) return res.status(404).json({ message: 'Tantárgy nem található' });

    const checkpointIndex = subjectData.checkpoints.findIndex(c => c.checkpointId === checkpointId);
    if (checkpointIndex === -1) return res.status(404).json({ message: 'Checkpoint nem található' });

    const checkpoint = subjectData.checkpoints[checkpointIndex];
    checkpoint.status = 'completed';
    checkpoint.attempts = (checkpoint.attempts || 0) + 1;
    checkpoint.completedAt = new Date();
    checkpoint.score = 85; // Temp: calculation kellene

    // Következő checkpoint feloldása
    if (checkpointIndex < subjectData.checkpoints.length - 1) {
      const nextCheckpoint = subjectData.checkpoints[checkpointIndex + 1];
      if (nextCheckpoint.status === 'locked') {
        nextCheckpoint.status = 'unlocked';
      }
    }

    // XP hozzáadása
    const xpEarned = 50 + Math.floor(checkpoint.score * 0.5);
    progress.addXP(xpEarned);

    await progress.save();

    res.json({
      message: 'Checkpoint teljesítve',
      xpEarned,
      totalXP: progress.totalXP,
      nextUnlocked: checkpointIndex < subjectData.checkpoints.length - 1
    });
  } catch (error) {
    console.error('[Student API] Error in checkpoint/complete:', error);
    res.status(500).json({ message: 'Hiba a checkpoint lezárásakor', error: error.message });
  }
});

// ==================== ROADMAP ROUTE ====================

// GET /api/student/roadmap/:subject - Roadmap lekérése
router.get('/roadmap/:subject', authMiddleware, async (req, res) => {
  try {
    const { subject } = req.params;
    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) return res.status(404).json({ message: 'Progress nem található' });

    const subjectData = progress.subjectProgress.find(s => s.subject === subject);
    if (!subjectData) return res.status(404).json({ message: 'Tantárgy nem található' });

    res.json({
      checkpoints: subjectData.checkpoints || [],
      totalXP: progress.totalXP,
      streak: progress.streak,
      subject
    });
  } catch (error) {
    console.error('[Student API] Error in roadmap/:subject:', error);
    res.status(500).json({ message: 'Hiba a roadmap lekérésekor', error: error.message });
  }
});

// GET /api/student/statistics
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const student = await User.findById(req.user._id).select('-password');
    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    const assignments = await Assignment.find({ submittedBy: req.user._id }).lean();

    const totalXP = progress?.totalXP || 0;
    const streak = progress?.streak || 0;
    const badges = progress?.badges || [];

    let totalAssignments = 0;
    let completedAssignments = 0;
    let totalPoints = 0;
    let achievedPoints = 0;
    const assignmentsStatistics = [];
    const topicStats = {};

    assignments.forEach(assignment => {
      totalAssignments++;
      const points = assignment.totalPoints || 100;
      const achieved = assignment.achievedPoints || 0;
      totalPoints += points;
      achievedPoints += achieved;

      if (assignment.submissionStatus === 'graded') {
        completedAssignments++;
      }

      assignmentsStatistics.push({
        totalPoints: points,
        achievedPoints: achieved,
        title: assignment.title
      });

      // Témakör statisztikák
      if (assignment.subject) {
        if (!topicStats[assignment.subject]) {
          topicStats[assignment.subject] = { scores: [], count: 0 };
        }
        const scorePercentage = points > 0 ? (achieved / points) * 100 : 0;
        topicStats[assignment.subject].scores.push(scorePercentage);
        topicStats[assignment.subject].count++;
      }
    });

    const averageScore = totalPoints > 0 ? Math.round((achievedPoints / totalPoints) * 100) : 0;

    // Témakör átlagok
    const topicStatsArray = Object.entries(topicStats).map(([topic, data]) => ({
      topic,
      averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count)
    }));

    // Erősségek és gyengeségek
    const strengths = topicStatsArray
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 3)
      .filter(t => t.averageScore >= 60);

    const weaknesses = topicStatsArray
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .filter(t => t.averageScore < 80);

    res.json({
      totalXP,
      streak,
      badges,
      averageScore,
      completedAssignments,
      totalAssignments,
      assignmentsStatistics,
      topicStats: topicStatsArray,
      strengths,
      weaknesses
    });
  } catch (error) {
    console.error('[Student API] Statistics error:', error);
    res.status(500).json({ message: 'Hiba a statisztikák lekérésekor', error: error.message });
  }
});

// (Legacy segédfüggvények meghagyva, ha valami régi kód még hivatkozna rájuk)
function generateInitialRoadmap(className) {
  return []; // Üresen hagyva, az új logika már a practicePath-et használja
}
function generateExtraPracticeNodes(subject, parentNodeId) {
  return [];
}

module.exports = router;