const path = require('path');
const fs = require('fs');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { buildContextForRole } = require('../services/aiContextService');
const StudentProgress = require('../models/StudentProgress');
const StudentChatHistory = require('../models/StudentChatHistory');
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const DiagnosticTest = require('../models/DiagnosticTest');
const DiagnosticResult = require('../models/DiagnosticResult');
const aiService = require('../services/aiService');
const { sendError } = require('../utils/errorResponse');
const ParentGoal = require('../models/ParentGoal');
const generationStore = require('../services/generationStore');

// Kérdésminőség javítása: ordering felirat + true_false mondat
const fixQuestionQuality = (questions) => questions.map(q => {
  if (q.questionType === 'ordering' && Array.isArray(q.items) && q.items.length >= 2) {
    // Keressük azt a kettőspontot, amelyet NEM szám előz meg (pl. "1:" nem, "alapján:" igen)
    const colonMatch = q.questionText.match(/(?<!\d)\s*:/);
    const colonIdx = colonMatch ? colonMatch.index : -1;
    if (colonIdx !== -1) {
      const afterColon = q.questionText.substring(colonIdx + 1);
      const itemsInText = q.items.filter(item => afterColon.includes(String(item))).length;
      if (itemsInText >= 2) {
        const clean = q.questionText.substring(0, colonIdx).trim().replace(/[!?.,]*$/, '') + '!';
        return { ...q, questionText: clean };
      }
    }
    // Számozott lista formátum "(1. elem, 2. elem)" vagy "(1) elem" nélkül kettőspont
    const listStart = q.questionText.search(/\(\s*\d+[.):\s]/);
    if (listStart > 5) {
      const beforeList = q.questionText.substring(0, listStart).trim().replace(/[!?.,]*$/, '');
      if (beforeList.length > 5) return { ...q, questionText: beforeList + '!' };
    }
  }
  if (q.questionType === 'true_false' && q.questionText.includes('?')) {
    const sentences = q.questionText.split(/(?<=[.!])\s+/);
    const stmt = sentences.find(s => !s.trim().endsWith('?'));
    if (stmt) return { ...q, questionText: stmt.trim() };
    const firstDot = q.questionText.indexOf('.');
    if (firstDot > 10) return { ...q, questionText: q.questionText.substring(0, firstDot + 1).trim() };
    // Nyílt kérdés true_false-ként → short_answer, az explanation legyen a helyes válasz referenciája
    return { ...q, questionType: 'short_answer', options: [], correctAnswer: q.explanation || q.correctAnswer || '' };
  }
  return q;
}).filter(q => q !== null);

const sanitizeQuestion = q => ({
  questionId:   q.questionId,
  questionText: q.questionText,
  questionType: q.questionType,
  category:     q.category,
  difficulty:   q.difficulty,
  options:      q.options,
  pairs:        q.pairs,
  items:        q.items
});

// MCQ integritás-ellenőrzés: biztosítja, hogy correctAnswer mindig az options között legyen
const ensureMcqIntegrity = (questions) => {
  const normStr = s => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  return questions.map((q, idx) => {
    if (q.questionType === 'mcq' && Array.isArray(q.options) && q.options.length > 0) {
      const normCA = normStr(q.correctAnswer);
      const matchIdx = q.options.findIndex(o => normStr(o) === normCA);
      if (matchIdx !== -1) {
        // Igazítjuk a correctAnswer-t az opció pontos szövegéhez (whitespace/case eltérés javítás)
        return { ...q, correctAnswer: q.options[matchIdx] };
      }
      // correctAnswer nem szerepel az opciók között – beillesszük és frissítjük
      const fallback = (q.correctAnswer != null && String(q.correctAnswer).trim())
        ? String(q.correctAnswer)
        : 'Helyes válasz';
      console.warn(`[MCQ integrity] q${idx + 1} correctAnswer nem volt options-ban, javítva: "${fallback.substring(0, 40)}"`);
      const newOptions = [...q.options];
      newOptions[newOptions.length - 1] = fallback;
      const shuffled = newOptions.sort(() => Math.random() - 0.5);
      return { ...q, options: shuffled, correctAnswer: fallback };
    }
    return q;
  });
};

function getRandomCurriculumTopics(subject, grade, count = 3) {
  const normSubject = String(subject).trim().toLowerCase();
  const gradeMatch = String(grade).match(/^(\d+)/);
  const gradeNum = gradeMatch ? parseInt(gradeMatch[1], 10) : null;
  if (!gradeNum) return null;
  const map = {
    'matematika':      { file: 'curriculum_matematika.json', min: 5, max: 8 },
    'nyelvtan':        { file: 'curriculum_nyelvtan.json',   min: 5, max: 8 },
    'irodalom':        { file: 'curriculum_irodalom.json',   min: 5, max: 8 },
    'történelem':      { file: 'curriculum_tortenelem.json', min: 5, max: 8 },
    'tortenelem':      { file: 'curriculum_tortenelem.json', min: 5, max: 8 },
    'környezetismeret':{ file: 'curriculum_kornyezet.json',  min: 5, max: 6 },
    'fizika':          { file: 'curriculum_fizika.json',     min: 7, max: 8 },
    'biológia':        { file: 'curriculum_biologia.json',   min: 7, max: 8 },
    'biologia':        { file: 'curriculum_biologia.json',   min: 7, max: 8 },
    'földrajz':        { file: 'curriculum_foldrajz.json',   min: 7, max: 8 },
    'foldrajz':        { file: 'curriculum_foldrajz.json',   min: 7, max: 8 },
    'angol':           { file: 'curriculum_angol.json',      min: 5, max: 8 },
    'német':           { file: 'curriculum_nemet.json',      min: 5, max: 8 },
    'nemet':           { file: 'curriculum_nemet.json',      min: 5, max: 8 },
  };
  const entry = map[normSubject];
  if (!entry || gradeNum < entry.min || gradeNum > entry.max) return null;
  try {
    const filePath = path.join(__dirname, '../data', entry.file);
    if (!fs.existsSync(filePath)) return null;
    const curriculum = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const topics = curriculum[String(gradeNum)] || [];
    if (topics.length === 0) return null;
    const shuffled = [...topics].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length)).map(t => t.id);
  } catch { return null; }
}

// Middleware to verify JWT token and get user
const authMiddleware = async (req, res, next) => {
  console.log('[Student API] Auth middleware for:', req.path);
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      console.log('[Student API] No token provided');
      return sendError(res, 401, 'Nincs jogosultság - nincs token', 'NO_TOKEN');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return sendError(res, 401, 'A munkamenet lejárt. Kérjük, jelentkezzen be újra.', 'TOKEN_EXPIRED');
      }
      return sendError(res, 401, 'Érvényes token szükséges', 'TOKEN_INVALID');
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.role !== 'student') {
      return sendError(res, 403, 'Csak diákok férhetnek hozzá', 'FORBIDDEN');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[Student API] Auth error:', error.message);
    return sendError(res, 500, 'Belső hiba az autentikáció során.', 'SERVER_ERROR');
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
      streak: progress.getEffectiveStreak(),
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

    res.json({ message: 'Sikeresen beküldve', xpEarned: 50, newBadges, totalXP: progress.totalXP, streak: progress.getEffectiveStreak() });
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
    const validSubjects = ['Matematika', 'Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Környezetismeret', 'Történelem', 'Fizika', 'Biológia', 'Földrajz'];
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
      streak: progress.getEffectiveStreak()
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
    const validSubjects = ['Matematika', 'Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Környezetismeret', 'Történelem', 'Fizika', 'Biológia', 'Földrajz'];
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
      streak: progress.getEffectiveStreak()
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
      streak: progress.getEffectiveStreak(),
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
    const safeCount = Math.min(Math.max(Number(count) || 3, 1), 15);

    const student = await User.findById(req.user._id);
    const grade = student ? student.className : 'általános iskola';

    const questions = await aiService.generatePracticeQuestionSet(subject, topic, difficulty || 3, safeCount, grade, [], [], req.user._id);
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
    const { subject, grade, selectedTopics } = req.body;
    const validSubjects = ['Matematika', 'Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Környezetismeret', 'Történelem', 'Fizika', 'Biológia', 'Földrajz'];
    if (!subject || !validSubjects.includes(subject)) {
      return res.status(400).json({ message: 'Érvénytelen vagy hiányzó tantárgy' });
    }

    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) {
      progress = new StudentProgress({ studentId: req.user._id });
    }

    // Dedup: if async generation already in progress for this subject, return the same session
    if (progress.diagnosticSession?.subject === subject && progress.diagnosticSession?.generationSessionId) {
      const activeGen = generationStore.getSession(progress.diagnosticSession.generationSessionId, req.user._id);
      if (activeGen && !activeGen.complete && !activeGen.error) {
        const existingInProgress = await DiagnosticResult.findOne({ studentId: req.user._id, subject, status: 'in_progress' });
        return res.json({
          sessionId: progress.diagnosticSession.generationSessionId,
          testId: existingInProgress?._id,
          totalQuestions: activeGen.totalCount,
          subject
        });
      }
    }

    // Resumed session: all questions already in DB
    const existingResult = await DiagnosticResult.findOne({
      studentId: req.user._id,
      subject,
      status: 'in_progress'
    });
    if (existingResult && progress.diagnosticSession?.subject === subject && progress.diagnosticSession.questions?.length > 0) {
      const sanitized = progress.diagnosticSession.questions.map(sanitizeQuestion);
      return res.json({ testId: existingResult._id, questions: sanitized, totalQuestions: sanitized.length, subject, resumed: true });
    }

    // New generation: create DB records immediately, start async
    const subjectProg = progress.subjectProgress?.find(sp => sp.subject === subject);
    const currentLevel = subjectProg?.currentLevel || 1;
    const totalQuestions = 10;
    const sessionGrade = grade || '4. osztály';

    const effectiveTopics = (selectedTopics?.length > 0)
      ? selectedTopics
      : getRandomCurriculumTopics(subject, sessionGrade, 5);

    const sessionId = generationStore.createSession(totalQuestions, req.user._id);

    const result = new DiagnosticResult({
      studentId:      req.user._id,
      subject,
      status:         'in_progress',
      totalQuestions,
      scorePercentage: 0,
      answers:        []
    });
    await result.save();

    progress.diagnosticSession = { subject, grade: sessionGrade, questions: [], startedAt: new Date(), generationSessionId: sessionId };
    progress.markModified('diagnosticSession');
    await progress.save();

    // Respond immediately
    res.json({ sessionId, testId: result._id, totalQuestions, subject });

    // Async generation (fire and forget)
    const userId = req.user._id;
    ;(async () => {
      try {
        const generatedQuestions = fixQuestionQuality(ensureMcqIntegrity(
          await aiService.generateDiagnosticTest(
            subject, sessionGrade, totalQuestions, currentLevel, effectiveTopics, userId,
            (chunk) => {
              const fixed = fixQuestionQuality(chunk);
              const san = fixed.map(sanitizeQuestion);
              generationStore.addChunk(sessionId, san, fixed);
            }
          )
        ));
        const freshProgress = await StudentProgress.findOne({ studentId: userId });
        if (freshProgress) {
          freshProgress.diagnosticSession = { subject, grade: sessionGrade, questions: generatedQuestions, startedAt: new Date() };
          freshProgress.markModified('diagnosticSession');
          await freshProgress.save();
        }
        generationStore.markComplete(sessionId);
        console.log(`[Diagnostic] Async generation complete, session=${sessionId}`);
      } catch (err) {
        console.error('[Diagnostic] Async generation error:', err.message);
        generationStore.markError(sessionId, 'A kérdések generálása sikertelen. Kérjük, próbálja újra.');
        // Cleanup failed records
        try {
          await DiagnosticResult.findByIdAndDelete(result._id);
          const fp = await StudentProgress.findOne({ studentId: userId });
          if (fp && fp.diagnosticSession?.subject === subject) {
            fp.diagnosticSession = undefined;
            fp.markModified('diagnosticSession');
            await fp.save();
          }
        } catch {}
      }
    })();
  } catch (error) {
    console.error('[Student API] Error in POST /diagnostic/start:', error);
    res.status(500).json({ message: 'Hiba történt a teszt indításakor', error: error.message });
  }
});

// GET /api/student/diagnostic/poll/:sessionId - Progressive question loading poll
router.get('/diagnostic/poll/:sessionId', authMiddleware, (req, res) => {
  const session = generationStore.getSession(req.params.sessionId, req.user._id);
  if (!session) return res.status(404).json({ message: 'Session not found or expired' });
  res.json({
    questions: session.sanitized,
    complete: session.complete,
    totalQuestions: session.totalCount,
    error: session.error || null
  });
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

    // Short/fill_blank kérdések párhuzamos AI ellenőrzése
    const shortCheckPromises = session.questions.map(q => {
      const studentAnswer = answers[q.questionId];
      if (studentAnswer && (q.questionType === 'short_answer' || q.questionType === 'fill_blank')) {
        return aiService.checkShortTextAnswer(session.subject, q.questionText, studentAnswer, q.correctAnswer)
          .then(r => ({ questionId: q.questionId, correct: r.correct }))
          .catch(() => ({ questionId: q.questionId, correct: false }));
      }
      return Promise.resolve({ questionId: q.questionId, correct: null });
    });
    const shortCheckResults = await Promise.all(shortCheckPromises);
    const shortCheckMap = Object.fromEntries(shortCheckResults.map(r => [r.questionId, r.correct]));

    // Kiértékelés
    const categoryResults = {};
    const perQuestionResults = [];

    for (const question of session.questions) {
      const qid = question.questionId;
      const studentAnswer = answers[qid];
      const cat = question.category || 'Általános';
      if (!categoryResults[cat]) categoryResults[cat] = { total: 0, correct: 0 };
      categoryResults[cat].total++;

      let isCorrect = false;
      if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
        if (question.questionType === 'mcq' || question.questionType === 'true_false') {
          isCorrect = norm(studentAnswer) === norm(question.correctAnswer);
        } else if (question.questionType === 'short_answer' || question.questionType === 'fill_blank') {
          isCorrect = shortCheckMap[qid] === true;
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
      perQuestionResults.push({
        questionId: qid, questionText: question.questionText, questionType: question.questionType,
        category: cat, options: question.options || [], pairs: question.pairs || [], items: question.items || [],
        correctAnswer: question.correctAnswer,
        studentAnswer: studentAnswer !== undefined ? studentAnswer : null,
        isCorrect
      });
    }

    const totalCount = session.questions.length;
    const correctCount = perQuestionResults.filter(r => r.isCorrect).length;
    const scorePercentage = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

    const categoryAnalysis = Object.entries(categoryResults).map(([category, data]) => ({
      category, totalQuestions: data.total, correctAnswers: data.correct,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      weaknesses: (data.correct / data.total) < 0.5 ? ['Fejlesztésre szorul'] : [],
      strengths:  (data.correct / data.total) >= 0.7 ? ['Jó alapok'] : []
    }));

    // Azonnali mentés (AI elemzés nélkül)
    result.totalQuestions = totalCount;
    result.correctAnswers = correctCount;
    result.scorePercentage = scorePercentage;
    result.categoryAnalysis = categoryAnalysis;
    result.completedAt = new Date();
    result.status = 'completed';
    await result.save();

    // Azonnali válasz a frontendnek – AI elemzés aszinkron fut
    res.json({
      message: 'Sikeresen beküldve',
      resultId: result._id,
      score: scorePercentage,
      categoryAnalysis,
      aiAnalysis: null,
      analyzing: true,
      perQuestionResults
    });

    // AI elemzés + gyakorlóút aszinkron (nem blokkolja a választ)
    const submittedUserId = req.user._id;
    const submittedSubject = session.subject;
    ;(async () => {
      try {
        const aiAnalysisResult = await aiService.analyzeDiagnosticTest(
          { subject: submittedSubject, grade: session.grade, scorePercentage, totalQuestions: totalCount, answers: perQuestionResults },
          session.questions.map(q => ({ category: q.category, questionText: q.questionText }))
        );

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

        await createOrUpdatePracticePath(submittedUserId, { aiAnalysis: aiAnalysisResult }, submittedSubject);

        const fp = await StudentProgress.findOne({ studentId: submittedUserId });
        if (fp) {
          fp.diagnosticSession = null;
          fp.markModified('diagnosticSession');
          await fp.save();
        }
        console.log(`[Diagnostic] Async analysis complete for result ${result._id}`);
      } catch (err) {
        console.error('[Diagnostic] Async analysis error:', err.message);
      }
    })();
  } catch (error) {
    console.error('[Student API] Error in /diagnostic/submit:', error);
    res.status(500).json({ message: 'Hiba történt a beküldéskor', error: error.message });
  }
});

// GET /api/student/diagnostic/analysis/:resultId – AI elemzés polling (aszinkron submit után)
router.get('/diagnostic/analysis/:resultId', authMiddleware, async (req, res) => {
  try {
    const result = await DiagnosticResult.findById(req.params.resultId);
    if (!result) return res.status(404).json({ message: 'Eredmény nem található' });
    if (result.studentId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Nincs jogosultság' });
    if (result.status === 'analyzed' && result.aiAnalysis) {
      return res.json({ ready: true, aiAnalysis: result.aiAnalysis });
    }
    res.json({ ready: false });
  } catch (error) {
    res.status(500).json({ message: 'Hiba az elemzés lekérésekor', error: error.message });
  }
});

// POST /api/student/diagnostic/question-analysis – kérdésenkénti AI elemzés
router.post('/diagnostic/question-analysis', authMiddleware, async (req, res) => {
  try {
    const { subject, questionText, correctAnswer, studentAnswer, isCorrect } = req.body;
    if (!subject || !questionText || correctAnswer === undefined) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }
    const analysis = await aiService.generateQuestionAnalysis(subject, questionText, correctAnswer, studentAnswer, !!isCorrect);
    res.json(analysis);
  } catch (error) {
    console.error('[Student API] Error in diagnostic/question-analysis:', error);
    res.status(500).json({ message: 'Hiba az elemzés generálásakor', error: error.message });
  }
});

// DELETE /api/student/progress/reset – összes egyéni gyakorlás adat törlése (fejlesztési célra)
router.delete('/progress/reset', authMiddleware, async (req, res) => {
  try {
    await StudentProgress.deleteOne({ studentId: req.user._id });
    await DiagnosticResult.deleteMany({ studentId: req.user._id });
    res.json({ message: 'Reset sikeres – minden egyéni gyakorlás adat törölve.' });
  } catch (error) {
    console.error('[Student API] Error in progress/reset:', error);
    res.status(500).json({ message: 'Hiba a reset során', error: error.message });
  }
});

// DELETE /api/student/progress/reset/:subject – egyetlen tantárgy adatainak törlése
router.delete('/progress/reset/:subject', authMiddleware, async (req, res) => {
  try {
    const { subject } = req.params;
    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress) return res.status(404).json({ message: 'Nincs adat' });

    progress.subjectProgress = progress.subjectProgress.filter(s => s.subject !== subject);
    if (progress.diagnosticSession?.subject === subject) progress.diagnosticSession = null;
    if (progress.checkpointSession?.subject === subject) progress.checkpointSession = null;

    await progress.save();
    await DiagnosticResult.deleteMany({ studentId: req.user._id, subject });

    res.json({ message: `${subject} adat törölve.` });
  } catch (error) {
    console.error('[Student API] Error in progress/reset/:subject:', error);
    res.status(500).json({ message: 'Hiba a tantárgy reset során', error: error.message });
  }
});

// ==================== TOVÁBBI TUTOR & STAT ENDPOINTOK ====================

router.post('/tutor/hint', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber, tone } = req.body;
    if (!subject || !topic || !questionText || !studentAnswer || !correctAnswer) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }
    const hint = await aiService.generateSocraticHint(subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber || 1, tone || 'teacher');
    res.json({ hint });
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt a tipp generálásakor', error: error.message });
  }
});

// A régi /tutor/question kompatibilitás miatt, hívja a Set-et count=1-gyel
router.post('/tutor/question', authMiddleware, async (req, res) => {
  try {
    const { subject, topic } = req.body;
    const student = await User.findById(req.user._id);
    const grade = student ? student.className : 'általános iskola';
    const questionsSet = await aiService.generatePracticeQuestionSet(subject, topic, 3, 1, grade, [], [], req.user._id);
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
      const result = await aiService.checkShortTextAnswer(subject, questionText, studentAnswer, correctAnswer);
      isCorrect = result.correct;
    } else {
      const norm = (s) => String(s).toLowerCase().trim().replace(/[.,!?]/g, '');
      isCorrect = norm(studentAnswer) === norm(correctAnswer);
    }

    if (isCorrect) {
      return res.json({ correct: true, message: 'Helyes válasz! Szép munka, lépjünk is tovább! 🎉' });
    } else {
      const hint = await aiService.generateSocraticHint(subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber || 1, tone || 'teacher');
      return res.json({ correct: false, hint });
    }
  } catch (error) {
    res.status(500).json({ message: 'Hiba történt az ellenőrzés során', error: error.message });
  }
});

router.get('/diagnostic/statuses', authMiddleware, async (req, res) => {
  try {
    const subjects = ['Matematika', 'Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Környezetismeret', 'Történelem'];
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
  let recommended = (aiAnalysis.recommendedCheckpoints || []).filter(r => r && r.topic);

  // Minimum 5 checkpoint biztosítása – ha az AI kevesebbet adott, kiegészítjük
  const subjectFallbackTopics = {
    'Matematika': [
      { topic: 'Számolás és alapműveletek', difficulty: 1 },
      { topic: 'Törtek és tizedes törtek', difficulty: 2 },
      { topic: 'Algebrai kifejezések', difficulty: 3 },
      { topic: 'Geometria és mértékegységek', difficulty: 3 },
      { topic: 'Szöveges feladatok', difficulty: 4 },
      { topic: 'Statisztika és valószínűség', difficulty: 4 }
    ],
    'Nyelvtan': [
      { topic: 'Szófajok felismerése', difficulty: 1 },
      { topic: 'Helyesírás alapszabályai', difficulty: 2 },
      { topic: 'Mondatelemzés', difficulty: 3 },
      { topic: 'Hangtani alapismeretek', difficulty: 3 },
      { topic: 'Nyelvhelyesség', difficulty: 4 }
    ],
    'Irodalom': [
      { topic: 'Népköltészet és mesék', difficulty: 1 },
      { topic: 'Szövegértés és olvasás', difficulty: 2 },
      { topic: 'Irodalmi műfajok', difficulty: 3 },
      { topic: 'Verselemzés alapjai', difficulty: 3 },
      { topic: 'Karakterek és cselekmény', difficulty: 4 }
    ],
    'Angol': [
      { topic: 'Alapvető szókincs', difficulty: 1 },
      { topic: 'Jelen idők és igeidők', difficulty: 2 },
      { topic: 'Szövegértés', difficulty: 3 },
      { topic: 'Múlt és jövő idők', difficulty: 3 },
      { topic: 'Kommunikációs feladatok', difficulty: 4 },
      { topic: 'Összetett grammatika', difficulty: 4 }
    ],
    'Német': [
      { topic: 'Alapvető szókincs és kifejezések', difficulty: 1 },
      { topic: 'Jelen idők és igealakok (Präsens, Perfekt)', difficulty: 2 },
      { topic: 'Szövegértés', difficulty: 3 },
      { topic: 'Múlt és jövő idők (Präteritum, Futur)', difficulty: 3 },
      { topic: 'Kommunikáció és fogalmazás', difficulty: 4 },
      { topic: 'Nyelvtani szerkezetek', difficulty: 4 }
    ],
    'Környezetismeret': [
      { topic: 'Élőlények és életközösségek', difficulty: 1 },
      { topic: 'Anyagok tulajdonságai', difficulty: 2 },
      { topic: 'Magyarország földrajza', difficulty: 2 },
      { topic: 'Természeti jelenségek', difficulty: 3 },
      { topic: 'Környezetvédelem', difficulty: 4 },
      { topic: 'Összefüggések a természetben', difficulty: 4 }
    ],
    'Történelem': [
      { topic: 'Ókori civilizációk és kultúrák', difficulty: 1 },
      { topic: 'A magyarság őstörténete és a honfoglalás', difficulty: 2 },
      { topic: 'Az Árpád-házi királyok kora', difficulty: 2 },
      { topic: 'Középkori élet, kultúra és hitvilág', difficulty: 3 },
      { topic: 'Helytörténet és nemzeti jelképek', difficulty: 4 }
    ]
  };

  if (recommended.length < 5) {
    const fallbacks = subjectFallbackTopics[subject] || [
      { topic: 'Alapfogalmak', difficulty: 1 }, { topic: 'Alkalmazás', difficulty: 2 },
      { topic: 'Összefüggések', difficulty: 3 }, { topic: 'Elemzés', difficulty: 4 },
      { topic: 'Komplex feladatok', difficulty: 5 }
    ];
    const existingTopics = recommended.map(r => r.topic);
    for (const fb of fallbacks) {
      if (recommended.length >= 5) break;
      if (!existingTopics.includes(fb.topic)) {
        recommended.push({ topic: fb.topic, difficulty: fb.difficulty, reason: 'Alapozó témakör' });
        existingTopics.push(fb.topic);
      }
    }
  }

  const checkpoints = recommended.map((rec, index) => ({
    checkpointId: `chk_${Date.now()}_${index}`,
    topic: rec.topic || 'Gyakorló feladat',
    gamifiedTitle: rec.gamifiedTitle || null,
    topicId: rec.topicId || null,
    difficulty: rec.difficulty || 3,
    status: index === 0 ? 'unlocked' : 'locked',
    score: 0,
    attempts: 0
  }));

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
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Üzenet megadása kötelező' });
    }
    console.log('[Student API] Chat send - Üzenet:', message.substring(0, 50) + '...');

    // Szűrés kikapcsolva a kérésnek megfelelően

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

    console.log('[Student API] Chat send - Erős területek:', strengths.length, 'Gyenge területek:', weaknesses.length);

    const dynamicContext = await buildContextForRole('student', req.user._id, message);
    
    // Alapértelmezett, fix kontextus a szintentartáshoz (bátorítás, magyarázat stb.)
    let specialContext = dynamicContext;
    let enhancedPrompt = message.toLowerCase();
    
    if (enhancedPrompt.includes('kérdezz ki') && enhancedPrompt.includes('gyengébb')) {
      specialContext += `\n\n[SPECIÁLIS KÉRÉS: A diák arra kéri, hogy kérdezzél ki a gyenge területeiről. Gyenge területek: ${weaknesses.join(', ') || 'még ismeretlen'}. Hozz létre egy rövid, kérdésből álló kvízt!]`;
    } else if (enhancedPrompt.includes('javít') && enhancedPrompt.includes('átlag')) {
      specialContext += `\n\n[SPECIÁLIS KÉRÉS: A diák a tanulmányi eredményeinek javítását szeretné. Adj konkrét, megvalósítható tanácsokat a tanulási szokásokra.]`;
    }

    const today = new Date().toLocaleDateString('hu-HU', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const systemPrompt = `Te a Feladify AI Tanára vagy – ${student.name} (${student.className || 'ismeretlen osztály'}) személyes oktatója és segítője.

Diák profil:
- Tantárgyak: ${student.subjects && student.subjects.length > 0 ? student.subjects.join(', ') : 'nem megadott'}
- Erős területek: ${strengths.length > 0 ? strengths.join(', ') : 'még nem mérhető'}
- Fejlesztendő: ${weaknesses.length > 0 ? weaknesses.join(', ') : 'nem jelezve'}
- Összesített XP: ${progress ? progress.totalXP : 0}
- Tanulási streak: ${progress ? progress.streak : 0} nap
- Mai dátum: ${today}

FONTOS SZABÁLYOK ÉS KORLÁTOZÁSOK:
1. Szigorúan csak a diákkal és a tanulásával kapcsolatos kérdésekre válaszolhatsz.
2. Szigorúan TILOS olyan információkat, tanári adatokat, rendszerarchitektúrát vagy szülői funkciókat megvitatnod, amelyek nem a diákhoz tartoznak. Más szerepkörökről (tanár, szülő) nem adhatsz ki információt.
3. Barátságos, bátorító, KONKRÉT, RÉSZLETES magyar válaszok (NEM generic felvezetés!).
4. Ha a diák köszön (pl. "Szia", "Helló", "Jó reggelt"), köszönj vissza barátságosan, majd ajánlj segítséget a tanuláshoz.
5. Egyszerű általános kérdésekre (pl. "Milyen nap van ma?", "Hogy vagy?") röviden, barátságosan válaszolj.
6. Egyértelműen nem tanulással kapcsolatos témáknál (szórakozás, filmek, zene, játékok): "Elnézést, de csak tanulással kapcsolatos kérdésekre tudok válaszolni! 📚"
7. Személyre szabva válaszolj a diák szintjéhez és szükségleteihez.
8. Soha ne magyarázz meg mindent – kérdésekkel segíts rájönni (Szókratikus módszer).
9. KONKRÉT válaszok: Ha dolgozatokról kérdez, ne csak nyersen listázd őket, hanem emberi mondatokba foglalva értékeld a teljesítményt.
10. Proaktív: tanácsok, motiváció, konkrét lépések.
11. FELDOLGOZÁSI SZABÁLY: A dinamikus kontextusban kapott adatokat (pl. dolgozatok listája) SOHA ne másold be gépies listaként! Olvasztva, a te szavaiddal, AI Tanárként kommunikáld (pl. "Látom, hogy a legutóbbi matek dolgozatod nagyon jól sikerült, 5-öst kaptál!").${specialContext}`;

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

    const streamMode = req.body.stream || req.query.stream === 'true';
    const ALLOWED_MODELS = ['dpv4pro', 'deepseek-reasoner', 'v4flash', 'deepseek-chat', 'qwen-3.5-plus', 'qwen-plus', 'qwen-3.5-flash', 'qwen-turbo'];
    const modelOverride = ALLOWED_MODELS.includes(req.body.modelOverride?.model) ? req.body.modelOverride : null;

    if (streamMode) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      console.log('[Student API] Chat send - Kezdődik a válasz streaming...');
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

    console.log('[Student API] Chat send - AI hívása előtt');
    const aiResponse = await aiService.generateResponse(systemPrompt, messagesForAI, { temperature: 0.75, max_tokens: 2048 }, true, modelOverride);
    console.log('[Student API] Chat send - AI válasz hossza:', aiResponse.length, 'Első 100 char:', aiResponse.substring(0, 100));

    chatDoc.addMessage('assistant', aiResponse);
    await chatDoc.save();

    res.json({ message: aiResponse, sessionId: chatDoc.currentSessionId });
  } catch (err) {
    console.error('[Student API] Chat send error:', err.message);
    if (res.headersSent) return;
    const isAI = err.message?.includes('nem elérhető');
    res.status(isAI ? 503 : 500).json({ message: isAI ? err.message : 'Hiba az üzenet feldolgozásakor', aiUnavailable: isAI });
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

    const recentSession = progress.checkpointSession?.checkpointId === checkpointId &&
      progress.checkpointSession.startedAt &&
      Date.now() - new Date(progress.checkpointSession.startedAt).getTime() < 120000;

    if (recentSession) {
      const existingQs = progress.checkpointSession.questions || [];
      if (existingQs.length > 0) {
        // Already complete in DB
        return res.json({
          checkpointId,
          checkpointTitle: checkpoint.topic,
          questions: existingQs.map(q => ({
            questionId: q.questionId, questionText: q.questionText, questionType: q.questionType,
            difficulty: q.difficulty, options: q.options, pairs: q.pairs, items: q.items
          })),
          difficulty: checkpoint.difficulty
        });
      }
      // Generation in progress - return existing sessionId
      const existingSessionId = progress.checkpointSession.generationSessionId;
      if (existingSessionId) {
        console.log('[checkpoint/start] Returning existing generation session');
        return res.json({
          sessionId: existingSessionId,
          checkpointId,
          checkpointTitle: checkpoint.topic,
          totalQuestions: 10,
          difficulty: checkpoint.difficulty
        });
      }
    }

    const student = await User.findById(req.user._id);
    const gradeNum = parseInt(student?.className) || 4;
    const currentLevel = subjectData.currentLevel || 1;
    const baseDifficulty = Math.max(1, Math.min(5, Math.ceil(gradeNum / 2)));
    const levelBonus = Math.floor((Math.max(1, Math.min(10, currentLevel)) - 1) / 3);
    const effectiveDifficulty = Math.max(1, Math.min(5, baseDifficulty + levelBonus));
    const weakQuestions = subjectData.weakQuestionsForNext || [];
    const totalQuestions = 10;

    const sessionId = generationStore.createSession(totalQuestions, req.user._id);

    // Save initial session to DB (with generationSessionId, empty questions)
    let saved = false;
    let attempts = 0;
    while (!saved && attempts < 2) {
      try {
        const freshProgress = await StudentProgress.findOne({ studentId: req.user._id });
        const freshSubjectData = freshProgress.subjectProgress.find(s => s.subject === subject);
        if (freshSubjectData) freshSubjectData.weakQuestionsForNext = null;
        freshProgress.checkpointSession = {
          checkpointId, subject, topic: checkpoint.topic,
          generationSessionId: sessionId,
          questions: [],
          answers: [],
          startedAt: new Date()
        };
        freshProgress.markModified('checkpointSession');
        freshProgress.markModified('subjectProgress');
        await freshProgress.save();
        saved = true;
      } catch (saveErr) {
        attempts++;
        if (saveErr.name === 'VersionError' && attempts < 2) continue;
        throw saveErr;
      }
    }

    // Respond immediately
    res.json({ sessionId, checkpointId, checkpointTitle: checkpoint.topic, totalQuestions, difficulty: checkpoint.difficulty });

    // Async generation
    const userId = req.user._id;
    const topic = checkpoint.topic;
    const studentGrade = student?.className || '4. osztály';
    ;(async () => {
      try {
        const rawQuestions = await aiService.generatePracticeQuestionSet(
          subject, topic, effectiveDifficulty, totalQuestions, studentGrade, weakQuestions, [], userId,
          (chunk) => {
            const fixed = fixQuestionQuality(chunk);
            const san = fixed.map(q => ({
              questionId: q.questionId, questionText: q.questionText, questionType: q.questionType,
              difficulty: q.difficulty, options: q.options, pairs: q.pairs, items: q.items
            }));
            generationStore.addChunk(sessionId, san, fixed);
          }
        );
        const generatedQuestions = fixQuestionQuality(ensureMcqIntegrity(rawQuestions));

        let dbSaved = false;
        let dbAttempts = 0;
        while (!dbSaved && dbAttempts < 3) {
          try {
            const fp = await StudentProgress.findOne({ studentId: userId });
            if (fp && fp.checkpointSession?.checkpointId === checkpointId) {
              fp.checkpointSession.questions = generatedQuestions;
              fp.markModified('checkpointSession');
              await fp.save();
            }
            dbSaved = true;
          } catch (e) {
            dbAttempts++;
            if (e.name === 'VersionError' && dbAttempts < 3) continue;
            throw e;
          }
        }
        generationStore.markComplete(sessionId);
        console.log(`[Checkpoint] Async generation complete, session=${sessionId}`);
      } catch (err) {
        console.error('[Checkpoint] Async generation error:', err.message);
        generationStore.markError(sessionId, 'A kérdések generálása sikertelen. Kérjük, próbálja újra.');
      }
    })();
  } catch (error) {
    console.error('[Student API] Error in checkpoint/start:', error);
    res.status(500).json({ message: 'Hiba a checkpoint indításakor', error: error.message });
  }
});

// GET /api/student/checkpoint/poll/:sessionId - Progressive question loading poll
router.get('/checkpoint/poll/:sessionId', authMiddleware, (req, res) => {
  const session = generationStore.getSession(req.params.sessionId, req.user._id);
  if (!session) return res.status(404).json({ message: 'Session not found or expired' });
  res.json({
    questions: session.sanitized,
    complete: session.complete,
    totalQuestions: session.totalCount,
    error: session.error || null
  });
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

    let question = session.questions.find(q => q.questionId === questionId);
    if (!question && session.generationSessionId) {
      const genSession = generationStore.getSession(session.generationSessionId);
      if (genSession) question = genSession.full.find(q => q.questionId === questionId);
      if (!question && genSession && !genSession.complete) {
        return res.status(202).json({ message: 'Ez a kérdés még generálódik, kérjük várj egy pillanatot!', stillGenerating: true });
      }
    }
    if (!question) {
      return res.status(404).json({ message: 'Kérdés nem található' });
    }

    // Típus szerinti valódi validáció
    let isCorrect = false;
    const norm = s => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,!?;:]/g, '');

    if (question.questionType === 'mcq' || question.questionType === 'true_false') {
      const normA = norm(answer);
      const normCA = norm(question.correctAnswer);
      isCorrect = normA === normCA;
      console.log(`[checkpoint/answer] MCQ ellenőrzés q="${question.questionId}" answer="${normA}" correct="${normCA}" match=${isCorrect}`);
    } else if (question.questionType === 'short_answer' || question.questionType === 'fill_blank') {
      const result = await aiService.checkShortTextAnswer(
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
      const chatHistory = req.body.chatHistory || [];
      hint = await aiService.generateCheckpointHint(
        subject, session.topic, question, answer, question.correctAnswer, attemptNumber, session.questions, session.answers, chatHistory
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
    const { checkpointId, questionId, studentAnswer, attemptNumber, chatHistory } = req.body;

    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    if (!progress || !progress.checkpointSession) {
      return res.status(404).json({ message: 'Nincs aktív checkpoint session' });
    }

    const session = progress.checkpointSession;
    const question = session.questions.find(q => q.questionId === questionId);
    if (!question) return res.status(404).json({ message: 'Kérdés nem található' });

    const hint = await aiService.generateCheckpointHint(
      session.subject,
      session.topic,
      question,
      studentAnswer,
      question.correctAnswer,
      attemptNumber || 1,
      session.questions,
      session.answers,
      chatHistory || []
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

    if (score < 80) {
      return res.status(400).json({
        message: 'A fejezet teljesítéséhez legalább 80% szükséges. Javítsd ki a hibás válaszokat!',
        score,
        canComplete: false
      });
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
      subjectData.weakQuestionsForNext = null; // szintváltáskor töröljük
    } else {
      // Gyenge kérdések kiszámítása az adaptív következő checkpoint-hoz
      const weakQs = [];
      if (session) {
        for (const q of session.questions) {
          const ans = session.answers.find(a => a.questionId === q.questionId);
          const wasSkipped = !ans;
          const wasHard = ans && !ans.isCorrect;
          const multipleAttempts = ans && (ans.attempts || 1) >= 2 && !ans.isCorrect;
          if (wasSkipped || wasHard || multipleAttempts) {
            weakQs.push({ questionText: q.questionText, questionType: q.questionType });
          }
        }
      }
      subjectData.weakQuestionsForNext = weakQs.slice(0, 3);
    }

    // XP: alap + nehézség * 8 + teljesítmény (max 50) + szintbónusz ha minden checkpoint kész
    const checkpointXP = 30 + (checkpoint.difficulty * 8) + Math.floor(score * 0.5);
    const levelBonusXP = allDone ? 100 : 0;
    const xpEarned = checkpointXP + levelBonusXP;
    progress.addXP(xpEarned);
    subjectData.subjectXP = (subjectData.subjectXP || 0) + xpEarned;
    const newBadges = progress.checkBadges();

    // Session törlése
    progress.checkpointSession = null;
    progress.markModified('subjectProgress');

    await progress.save();

    res.json({
      message: 'Checkpoint teljesítve',
      score,
      xpEarned,
      totalXP: progress.totalXP,
      streak: progress.getEffectiveStreak(),
      newBadges,
      nextUnlocked: checkpointIndex < subjectData.checkpoints.length - 1,
      levelComplete: allDone,
      currentLevel: subjectData.currentLevel || 1
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
      subjectXP: subjectData.subjectXP || 0,
      streak: progress.getEffectiveStreak(),
      subject,
      status: subjectData.status,
      currentLevel: subjectData.currentLevel || 1
    });
  } catch (error) {
    console.error('[Student API] Error in roadmap/:subject:', error);
    res.status(500).json({ message: 'Hiba a roadmap lekérésekor', error: error.message });
  }
});

// GET /api/student/statistics
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const [student, progress] = await Promise.all([
      User.findById(req.user._id).populate('assignments.assignmentId', 'title totalPoints subject'),
      StudentProgress.findOne({ studentId: req.user._id })
    ]);

    if (!student) return res.status(404).json({ message: 'Diák nem található.' });

    const validAssignments = student.assignments.filter(a => a.assignmentId != null);
    const gradedAssignments = validAssignments.filter(a => a.grade != null);

    const totalAssignments = validAssignments.length;
    const completedAssignments = gradedAssignments.length;

    let totalAchieved = 0;
    let totalPossible = 0;
    const topicStats = {};

    const assignmentsStatistics = gradedAssignments.map(a => {
      const points = a.assignmentId.totalPoints || 0;
      const achieved = a.achievedPoints || 0;
      totalAchieved += achieved;
      totalPossible += points;

      const subject = a.assignmentId.subject;
      if (subject) {
        if (!topicStats[subject]) topicStats[subject] = { scores: [], count: 0 };
        topicStats[subject].scores.push(points > 0 ? (achieved / points) * 100 : 0);
        topicStats[subject].count++;
      }

      return {
        title: a.assignmentId.title,
        subject,
        achievedPoints: achieved,
        totalPoints: points,
        completedAt: a.completedAt,
        grade: a.grade ?? null,
      };
    });

    const averageScore = totalPossible > 0
      ? Math.round((totalAchieved / totalPossible) * 100)
      : 0;

    assignmentsStatistics.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    const topicStatsArray = Object.entries(topicStats).map(([topic, data]) => ({
      topic,
      averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count)
    }));

    const strengths = [...topicStatsArray]
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 3)
      .filter(t => t.averageScore >= 60);

    const weaknesses = [...topicStatsArray]
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3)
      .filter(t => t.averageScore < 80);

    res.json({
      totalAssignments,
      completedAssignments,
      averageScore,
      assignmentsStatistics,
      strengths,
      weaknesses,
      totalXP: progress?.totalXP || 0,
      streak: progress ? progress.getEffectiveStreak() : 0
    });
  } catch (error) {
    console.error('[Student API] Statistics error:', error);
    res.status(500).json({ message: 'Hiba a statisztikák lekérésekor', error: error.message });
  }
});

// GET /api/student/practice-statistics
router.get('/practice-statistics', authMiddleware, async (req, res) => {
  try {
    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    const diagnosticResults = await DiagnosticResult.find({
      studentId: req.user._id,
      status: { $in: ['completed', 'analyzed'] }
    }).sort({ completedAt: -1 }).lean();

    const totalXP = progress?.totalXP || 0;
    const streak = progress ? progress.getEffectiveStreak() : 0;
    const badges = progress?.badges || [];
    const subjectProgressArr = progress?.subjectProgress || [];

    const subjectStats = subjectProgressArr.map(sp => {
      const checkpoints = sp.checkpoints || [];
      const completed = checkpoints.filter(c => c.status === 'completed');
      const avgScore = completed.length > 0
        ? Math.round(completed.reduce((s, c) => s + (c.score || 0), 0) / completed.length)
        : 0;
      const bestScore = completed.length > 0
        ? Math.max(...completed.map(c => c.score || 0))
        : 0;
      const checkpointDetails = checkpoints
        .map((c, i) => ({ idx: i, score: c.score || 0, status: c.status, difficulty: c.difficulty || 3, attempts: c.attempts || 1, completedAt: c.completedAt }))
        .filter(c => c.status === 'completed');

      return {
        subject: sp.subject,
        status: sp.status || 'not_started',
        currentLevel: sp.currentLevel || 1,
        subjectXP: sp.subjectXP || 0,
        totalCheckpoints: checkpoints.length,
        completedCheckpoints: completed.length,
        avgScore,
        bestScore,
        checkpointDetails
      };
    });

    // Most recent diagnostic per subject
    const diagnosticMap = {};
    diagnosticResults.forEach(dr => {
      if (!diagnosticMap[dr.subject]) {
        diagnosticMap[dr.subject] = {
          subject: dr.subject,
          scorePercentage: dr.scorePercentage || 0,
          categoryAnalysis: dr.categoryAnalysis || [],
          aiAnalysis: dr.aiAnalysis || null,
          completedAt: dr.completedAt,
          totalQuestions: dr.totalQuestions || 0,
          correctAnswers: dr.correctAnswers || 0
        };
      }
    });

    const totalCheckpointsCompleted = subjectStats.reduce((s, sub) => s + sub.completedCheckpoints, 0);
    const activeSubs = subjectStats.filter(s => s.completedCheckpoints > 0);
    const overallAvgScore = activeSubs.length > 0
      ? Math.round(activeSubs.reduce((s, sub) => s + sub.avgScore, 0) / activeSubs.length)
      : 0;

    res.json({
      totalXP,
      streak,
      badges,
      subjectStats,
      diagnosticBySubject: Object.values(diagnosticMap),
      totalCheckpointsCompleted,
      overallAvgScore
    });
  } catch (error) {
    console.error('[Student API] Practice statistics error:', error);
    res.status(500).json({ message: 'Hiba az egyéni gyakorlás statisztikák lekérésekor', error: error.message });
  }
});

// GET /api/student/goals - Szülő által felállított célkitűzések lekérése haladással
router.get('/goals', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user._id;
    const [goalDocs, childData, progressData] = await Promise.all([
      ParentGoal.find({ childId: studentId }).populate('parentId', 'name'),
      User.findById(studentId).populate('assignments.assignmentId', 'subject totalPoints'),
      StudentProgress.findOne({ studentId })
    ]);

    const streak = progressData ? progressData.getEffectiveStreak() : 0;
    const totalXP = progressData?.totalXP || 0;
    const subjectProgress = progressData?.subjectProgress || [];

    const allGoals = [];

    for (const doc of goalDocs) {
      const parentName = doc.parentId?.name || 'Szülő';
      for (const goal of doc.goals) {
        let current = 0, target = 1, unit = '', count = null;

        if (goal.type === 'assignment_avg') {
          const since = new Date(Date.now() - (goal.periodDays || 7) * 864e5);
          const relevant = (childData?.assignments || []).filter(a => {
            if (!a.assignmentId || a.grade == null) return false;
            if (goal.subject !== 'all' && a.assignmentId.subject !== goal.subject) return false;
            return a.completedAt && new Date(a.completedAt) >= since;
          });
          count = relevant.length;
          target = goal.targetPercent || 1;
          if (count > 0) {
            current = Math.round(
              relevant.reduce((s, a) => {
                const pts = a.assignmentId.totalPoints || 0;
                return s + (pts > 0 ? (a.achievedPoints / pts) * 100 : 0);
              }, 0) / count
            );
          }
          unit = '%';
        } else if (goal.type === 'practice_xp') {
          target = goal.targetXP || 1;
          let delta;
          if (goal.subject === 'all') {
            delta = Math.max(0, totalXP - (goal.startTotalXP || 0));
          } else {
            const sp = subjectProgress.find(s => s.subject === goal.subject);
            delta = Math.max(0, (sp?.subjectXP || 0) - (goal.startSubjectXP || 0));
          }
          current = Math.min(delta, target);
          unit = 'XP';
        } else if (goal.type === 'practice_streak') {
          target = goal.targetStreak || 1;
          current = Math.min(streak, target);
          unit = 'nap';
        }

        const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

        allGoals.push({
          goalId: goal._id.toString(),
          type: goal.type,
          subject: goal.subject,
          title: goal.title,
          targetPercent: goal.targetPercent,
          periodDays: goal.periodDays,
          targetXP: goal.targetXP,
          targetStreak: goal.targetStreak,
          deadline: goal.deadline,
          createdAt: goal.createdAt,
          parentName,
          progress: { current, target, unit, pct, count }
        });
      }
    }

    res.json({ goals: allGoals });
  } catch (error) {
    console.error('[Student API] Get goals error:', error);
    res.status(500).json({ message: 'Hiba a célkitűzések lekérésekor.' });
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