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

// POST /api/student/diagnostic/start - Diagnosztikai teszt indítása (AI-generált)
router.post('/diagnostic/start', authMiddleware, async (req, res) => {
  try {
    const { subject, grade } = req.body;
    const validSubjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    if (!subject || !validSubjects.includes(subject)) {
      return res.status(400).json({ message: 'Érvénytelen vagy hiányzó tantárgy' });
    }

    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) {
      progress = new StudentProgress({ studentId: req.user._id });
    }

    // Ha van folyamatban lévő teszt ugyanarra a tantárgyra, adjuk vissza azt
    const existingResult = await DiagnosticResult.findOne({
      studentId: req.user._id,
      subject,
      status: 'in_progress'
    });

    if (existingResult && progress.diagnosticSession?.subject === subject) {
      const sanitized = progress.diagnosticSession.questions.map(q => ({
        questionId:   q.questionId,
        questionText: q.questionText,
        questionType: q.questionType,
        category:     q.category,
        difficulty:   q.difficulty,
        options:      q.options,
        pairs:        q.pairs,
        items:        q.items
      }));
      return res.json({ testId: existingResult._id, questions: sanitized, totalQuestions: sanitized.length, subject, resumed: true });
    }

    // AI-val generálunk 20 kérdést
    console.log(`[Diagnostic] Generating questions for ${subject} / ${grade || '4. osztály'}`);
    const generatedQuestions = await groqService.generateDiagnosticTest(subject, grade || '4. osztály', 20);

    // Teljes kérdéssort (correctAnswer-rel) elmentjük a session-be
    progress.diagnosticSession = {
      subject,
      grade: grade || '4. osztály',
      questions: generatedQuestions,
      startedAt: new Date()
    };
    progress.markModified('diagnosticSession');
    await progress.save();

    // DiagnosticResult rekord létrehozása
    const result = new DiagnosticResult({
      studentId:     req.user._id,
      subject,
      status:        'in_progress',
      totalQuestions: generatedQuestions.length,
      scorePercentage: 0,
      answers:       []
    });
    await result.save();

    // Sanitizált kérdések (correctAnswer nélkül) a frontendnek
    const sanitizedQuestions = generatedQuestions.map(q => ({
      questionId:   q.questionId,
      questionText: q.questionText,
      questionType: q.questionType,
      category:     q.category,
      difficulty:   q.difficulty,
      options:      q.options,
      pairs:        q.pairs,
      items:        q.items
    }));

    res.json({ testId: result._id, questions: sanitizedQuestions, totalQuestions: sanitizedQuestions.length, subject });
  } catch (error) {
    console.error('[Student API] Error in POST /diagnostic/start:', error);
    res.status(500).json({ message: 'Hiba történt a teszt indításakor', error: error.message });
  }
});

// GET /api/student/diagnostic/start/:subject - legacy redirect to POST
router.get('/diagnostic/start/:subject', authMiddleware, (req, res) => {
  res.status(405).json({ message: 'Kérlek POST /diagnostic/start végpontot használj' });
});

// POST /api/student/diagnostic/submit - Diagnosztikai teszt beküldése (session-alapú validáció)
router.post('/diagnostic/submit', authMiddleware, async (req, res) => {
  try {
    const { testId, subject, answers } = req.body;
    if (!testId || !answers || typeof answers !== 'object') {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    const result = await DiagnosticResult.findById(testId);
    if (!result) return res.status(404).json({ message: 'Teszt nem található' });
    if (result.studentId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Nincs jogosultság' });
    if (result.status !== 'in_progress') return res.status(400).json({ message: 'A teszt már be lett küldve' });

    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress?.diagnosticSession) {
      return res.status(404).json({ message: 'Teszt session nem található – kérlek kezdj új tesztet' });
    }

    const session = progress.diagnosticSession;
    const norm = s => String(s).toLowerCase().trim().replace(/[.,!?;:]/g, '');

    // Kiértékelés és kategória-statisztikák gyűjtése
    const categoryResults = {};
    const perQuestionResults = [];

    for (const question of session.questions) {
      const qid = question.questionId;
      const studentAnswer = answers[qid];
      const cat = question.category || 'Általános';

      if (!categoryResults[cat]) {
        categoryResults[cat] = { total: 0, correct: 0 };
      }
      categoryResults[cat].total++;

      let isCorrect = false;

      if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
        if (question.questionType === 'mcq' || question.questionType === 'true_false') {
          isCorrect = norm(studentAnswer) === norm(question.correctAnswer);
        } else if (question.questionType === 'short_answer' || question.questionType === 'fill_blank') {
          const aiResult = await groqService.checkShortTextAnswer(
            session.subject, question.questionText, studentAnswer, question.correctAnswer
          );
          isCorrect = aiResult.correct;
        } else if (question.questionType === 'matching') {
          if (typeof studentAnswer === 'object' && !Array.isArray(studentAnswer)) {
            const correct = question.correctAnswer || {};
            isCorrect = Object.keys(correct).length > 0 &&
              Object.keys(correct).every(k => norm(studentAnswer[k]) === norm(correct[k]));
          }
        } else if (question.questionType === 'ordering') {
          if (Array.isArray(studentAnswer) && Array.isArray(question.correctAnswer)) {
            isCorrect = studentAnswer.length === question.correctAnswer.length &&
              studentAnswer.every((item, idx) => norm(item) === norm(question.correctAnswer[idx]));
          }
        }
      }

      if (isCorrect) categoryResults[cat].correct++;
      perQuestionResults.push({ questionId: qid, isCorrect, category: cat });
    }

    const totalCount = session.questions.length;
    const correctCount = perQuestionResults.filter(r => r.isCorrect).length;
    const scorePercentage = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    // Kategória-elemzés összeállítása
    const categoryAnalysis = Object.entries(categoryResults).map(([category, data]) => ({
      category,
      totalQuestions: data.total,
      correctAnswers: data.correct,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      weaknesses: (data.correct / data.total) < 0.5 ? ['Fejlesztésre szorul'] : [],
      strengths:  (data.correct / data.total) >= 0.7 ? ['Jó alapok'] : []
    }));

    // AI elemzés (checkpoint-ajánlatok)
    const aiAnalysisResult = await groqService.analyzeDiagnosticTest(
      { subject: session.subject, scorePercentage, totalQuestions: totalCount, answers: perQuestionResults },
      session.questions.map((q, i) => ({ category: q.category, questionText: q.questionText }))
    );

    // Eredmény mentése
    result.totalQuestions = totalCount;
    result.correctAnswers = correctCount;
    result.scorePercentage = scorePercentage;
    result.categoryAnalysis = categoryAnalysis;
    result.completedAt = new Date();
    result.status = 'analyzed';
    result.aiAnalysis = {
      overallPerformance: aiAnalysisResult.overallPerformance || 'average',
      personalizedFeedback: aiAnalysisResult.personalizedFeedback || '',
      strengths: (aiAnalysisResult.strengths || []).map(s => ({ category: s.category, description: s.description, confidence: 0.8 })),
      weaknesses: [],
      learningPath: { recommendedOrder: [], estimatedTime: 0, focusAreas: [] },
      recommendedCheckpoints: aiAnalysisResult.recommendedCheckpoints || []
    };
    await result.save();

    // Gyakorlóút létrehozása/frissítése – az AI raw eredményt adjuk át (recommendedCheckpoints megmarad)
    await createOrUpdatePracticePath(req.user._id, { aiAnalysis: aiAnalysisResult }, session.subject);

    // Session törlése
    progress.diagnosticSession = null;
    progress.markModified('diagnosticSession');
    await progress.save();

    res.json({
      message: 'Sikeresen beküldve',
      resultId: result._id,
      score: scorePercentage,
      categoryAnalysis,
      aiAnalysis: result.aiAnalysis
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
    const sessions = chatDoc.sessions
      .map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        updatedAt: s.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Érvényesítés: csak az adott diák üzenetei jelenjenek meg
    const validatedMessages = session ? session.messages.map(msg => {
      // Szűrés: ha user üzenet és userId megadott, akkor csak az aktuális diák üzenete
      if (msg.role === 'user' && msg.userId && msg.userId.toString() !== req.user._id.toString()) {
        console.log('[Student API] Message filtered out:', msg.content.substring(0, 20), 'userId:', msg.userId, 'currentUser:', req.user._id);
        return null;
      }
      return msg;
    }).filter(msg => msg !== null) : [];

    console.log('[Student API] Loaded session messages:', validatedMessages.length, 'out of', session?.messages.length);

    res.json({
      messages: validatedMessages,
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
    chatDoc.addMessage('user', message, req.user._id);
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

    // Érvényesítés: csak az adott diák üzenetei jelenjenek meg
    const validatedMessages = session.messages.map(msg => {
      // User üzenetek: userId-nak az aktuális diáknak kell lennie vagy üresen is hagyható (legacy)
      if (msg.role === 'user' && msg.userId && msg.userId.toString() !== req.user._id.toString()) {
        return null;
      }
      return msg;
    }).filter(msg => msg !== null);

    chatDoc.currentSessionId = sessionId;
    await chatDoc.save();

    const sessions = chatDoc.sessions
      .map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        updatedAt: s.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      messages: validatedMessages,
      sessions
    });
  } catch (err) {
    console.error('[Student API] Load session error:', err.message);
    res.status(500).json({ message: 'Hiba a session betöltésekor', error: err.message });
  }
});

// DELETE /api/student/chat/session/:sessionId
router.delete('/chat/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID megadása kötelező' });
    }

    let chatDoc = await StudentChatHistory.findOne({ studentId: req.user._id });
    if (!chatDoc) {
      return res.status(404).json({ message: 'Chat előzmények nem találhatók' });
    }

    const sessionIndex = chatDoc.sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ message: 'Session nem található' });
    }

    chatDoc.sessions.splice(sessionIndex, 1);

    // Ha az éppen aktív sessiont töröljük, nullázd a currentSessionId-t
    if (chatDoc.currentSessionId === sessionId) {
      chatDoc.currentSessionId = null;
    }

    await chatDoc.save();

    const sessions = chatDoc.sessions
      .map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        updatedAt: s.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      message: 'Session sikeresen törölve',
      sessions
    });
  } catch (err) {
    console.error('[Student API] Delete session error:', err.message);
    res.status(500).json({ message: 'Hiba a session törlése során', error: err.message });
  }
});

// PUT /api/student/chat/session/:sessionId
router.put('/chat/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID megadása kötelező' });
    }

    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'Session név megadása kötelező' });
    }

    let chatDoc = await StudentChatHistory.findOne({ studentId: req.user._id });
    if (!chatDoc) {
      return res.status(404).json({ message: 'Chat előzmények nem találhatók' });
    }

    const session = chatDoc.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session nem található' });
    }

    session.title = title.substring(0, 100);
    await chatDoc.save();

    const sessions = chatDoc.sessions
      .map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        updatedAt: s.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      message: 'Session neve sikeresen megváltoztatva',
      sessions
    });
  } catch (err) {
    console.error('[Student API] Update session error:', err.message);
    res.status(500).json({ message: 'Hiba a session név módosítása során', error: err.message });
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

    // Kérdéssor generálása AI-val (6+ feladattípus)
    const generatedQuestions = await groqService.generatePracticeQuestionSet(
      subject, checkpoint.topic, checkpoint.difficulty, 10
    );

    // Kérdések mentése a session-be (correctAnswer-rel együtt, a backenden marad)
    progress.checkpointSession = {
      checkpointId,
      subject,
      topic: checkpoint.topic,
      questions: generatedQuestions,
      answers: [],
      startedAt: new Date()
    };
    await progress.save();

    // Frontend csak sanitizált kérdéseket kap (correctAnswer nélkül)
    const sanitizedQuestions = generatedQuestions.map(q => ({
      questionId:   q.questionId,
      questionText: q.questionText,
      questionType: q.questionType,
      difficulty:   q.difficulty,
      options:      q.options,
      pairs:        q.pairs,
      items:        q.items
    }));

    res.json({
      checkpointId,
      checkpointTitle: checkpoint.topic,
      questions: sanitizedQuestions,
      difficulty: checkpoint.difficulty
    });
  } catch (error) {
    console.error('[Student API] Error in checkpoint/start:', error);
    res.status(500).json({ message: 'Hiba a checkpoint indításakor', error: error.message });
  }
});

// POST /api/student/checkpoint/answer - Válasz valódi ellenőrzése
router.post('/checkpoint/answer', authMiddleware, async (req, res) => {
  try {
    const { checkpointId, questionId, answer, subject } = req.body;
    if (!checkpointId || !questionId || answer === undefined || answer === null) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress || !progress.checkpointSession) {
      return res.status(404).json({ message: 'Nincs aktív checkpoint session' });
    }

    const session = progress.checkpointSession;
    if (session.checkpointId !== checkpointId) {
      return res.status(400).json({ message: 'Checkpoint ID nem egyezik' });
    }

    const question = session.questions.find(q => q.questionId === questionId);
    if (!question) {
      return res.status(404).json({ message: 'Kérdés nem található' });
    }

    // Típus szerinti valódi validáció
    let isCorrect = false;
    const norm = s => String(s).toLowerCase().trim().replace(/[.,!?;:]/g, '');

    if (question.questionType === 'mcq' || question.questionType === 'true_false') {
      isCorrect = norm(answer) === norm(question.correctAnswer);
    } else if (question.questionType === 'short_answer' || question.questionType === 'fill_blank') {
      const result = await groqService.checkShortTextAnswer(
        subject, question.questionText, answer, question.correctAnswer
      );
      isCorrect = result.correct;
    } else if (question.questionType === 'matching') {
      // answer: { "bal elem": "jobb elem", ... }
      if (typeof answer === 'object' && !Array.isArray(answer)) {
        const correct = question.correctAnswer || {};
        isCorrect = Object.keys(correct).every(k => norm(answer[k]) === norm(correct[k]));
      }
    } else if (question.questionType === 'ordering') {
      // answer: ["elem A", "elem B", "elem C"]
      if (Array.isArray(answer) && Array.isArray(question.correctAnswer)) {
        isCorrect = answer.length === question.correctAnswer.length &&
          answer.every((item, idx) => norm(item) === norm(question.correctAnswer[idx]));
      }
    }

    // Válasz tárolása / attempts növelése a session-ben
    const existingAnswer = session.answers.find(a => a.questionId === questionId);
    let attemptNumber = 1;
    if (existingAnswer) {
      existingAnswer.studentAnswer = answer;
      existingAnswer.isCorrect = isCorrect;
      existingAnswer.attempts = (existingAnswer.attempts || 1) + 1;
      attemptNumber = existingAnswer.attempts;
    } else {
      session.answers.push({ questionId, studentAnswer: answer, isCorrect, attempts: 1 });
    }

    // Aktuális score kiszámítása
    const uniqueCorrect = session.questions.filter(q => {
      const ans = session.answers.find(a => a.questionId === q.questionId);
      return ans?.isCorrect;
    }).length;
    const total = session.questions.length;

    // AI visszajelzés
    let aiMessage;
    let hint = null;
    if (isCorrect) {
      aiMessage = `Helyes! Jól gondoltad át. 🎉 (${uniqueCorrect}/${total} helyes eddig)`;
    } else {
      hint = await groqService.generateSocraticHint(
        subject, session.topic, question.questionText, answer, question.correctAnswer, attemptNumber
      );
      aiMessage = `Nem egészen... Gondold át még egyszer! 💡`;
    }

    // Mongoose mixed típus miatt markModified kell
    progress.markModified('checkpointSession');
    await progress.save();

    res.json({
      isCorrect,
      aiMessage,
      hint,
      currentScore: {
        correct: uniqueCorrect,
        total,
        percentage: Math.round((uniqueCorrect / total) * 100)
      }
    });
  } catch (error) {
    console.error('[Student API] Error in checkpoint/answer:', error);
    res.status(500).json({ message: 'Hiba az ellenőrzéskor', error: error.message });
  }
});

// POST /api/student/checkpoint/hint - AI mentor tipp (correctAnswer nem kerül ki frontend felé)
router.post('/checkpoint/hint', authMiddleware, async (req, res) => {
  try {
    const { checkpointId, questionId, studentAnswer, attemptNumber } = req.body;

    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress || !progress.checkpointSession) {
      return res.status(404).json({ message: 'Nincs aktív checkpoint session' });
    }

    const session = progress.checkpointSession;
    const question = session.questions.find(q => q.questionId === questionId);
    if (!question) return res.status(404).json({ message: 'Kérdés nem található' });

    const hint = await groqService.generateCheckpointHint(
      session.subject,
      session.topic,
      question,
      studentAnswer,
      question.correctAnswer,
      attemptNumber || 1,
      session.questions,
      session.answers
    );

    res.json({ hint });
  } catch (error) {
    console.error('[Student API] Error in checkpoint/hint:', error);
    res.status(500).json({ message: 'Hiba a tipp generálása során', error: error.message });
  }
});

// POST /api/student/checkpoint/complete - Checkpoint lezárása valódi score-ral
router.post('/checkpoint/complete', authMiddleware, async (req, res) => {
  try {
    const { checkpointId, subject } = req.body;
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

    // Valódi score számítás a tárolt session alapján
    let score = 0;
    const session = progress.checkpointSession;
    if (session && session.checkpointId === checkpointId && session.questions.length > 0) {
      const correctCount = session.questions.filter(q => {
        const ans = session.answers.find(a => a.questionId === q.questionId);
        return ans?.isCorrect;
      }).length;
      score = Math.round((correctCount / session.questions.length) * 100);
    }

    checkpoint.status = 'completed';
    checkpoint.attempts = (checkpoint.attempts || 0) + 1;
    checkpoint.completedAt = new Date();
    checkpoint.score = score;

    // Következő checkpoint feloldása
    if (checkpointIndex < subjectData.checkpoints.length - 1) {
      const nextCheckpoint = subjectData.checkpoints[checkpointIndex + 1];
      if (nextCheckpoint.status === 'locked') {
        nextCheckpoint.status = 'unlocked';
      }
    }

    // Ha az utolsó checkpoint teljesült, level_complete
    const allDone = subjectData.checkpoints.every(c => c.status === 'completed');
    if (allDone) {
      subjectData.status = 'level_complete';
    }

    // XP: alap + nehézség * 8 + teljesítmény (max 50)
    const xpEarned = 30 + (checkpoint.difficulty * 8) + Math.floor(score * 0.5);
    progress.addXP(xpEarned);
    const newBadges = progress.checkBadges();

    // Session törlése
    progress.checkpointSession = null;

    await progress.save();

    res.json({
      message: 'Checkpoint teljesítve',
      score,
      xpEarned,
      totalXP: progress.totalXP,
      streak: progress.streak,
      newBadges,
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