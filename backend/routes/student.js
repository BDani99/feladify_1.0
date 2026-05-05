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
    console.log('[Student API] Token present:', !!token);
    
    if (!token) {
      console.log('[Student API] No token provided');
      return res.status(401).json({ message: 'Nincs jogosultság - nincs token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('[Student API] Decoded token:', { userId: decoded.userId });
    
    const user = await User.findById(decoded.userId);
    console.log('[Student API] User found:', !!user, 'Role:', user?.role);
    
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

// GET /api/student/roadmap - Diák útvonalának lekérése
router.get('/roadmap', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /roadmap - User:', req.user._id);
  try {
    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    console.log('[Student API] Progress found:', !!progress);
    
    if (!progress) {
      console.log('[Student API] Creating new progress for user');
      // Create initial progress for new student
      progress = new StudentProgress({
        studentId: req.user._id,
        roadmap: generateInitialRoadmap(req.user.className)
      });
      await progress.save();
      console.log('[Student API] New progress created');
    }

    // Update streak
    progress.updateStreak();
    await progress.save();

    console.log('[Student API] Sending response with XP:', progress.totalXP);
    res.json({
      totalXP: progress.totalXP,
      streak: progress.streak,
      badges: progress.badges,
      roadmap: progress.roadmap,
      dailyGoal: progress.dailyGoal,
      weeklyGoal: progress.weeklyGoal
    });
  } catch (error) {
    console.error('[Student API] Error in /roadmap:', error);
    res.status(500).json({ message: 'Hiba történt az útvonal lekérésekor', error: error.message });
  }
});

// POST /api/student/roadmap/submit - Szintfelmérő beküldése
router.post('/roadmap/submit', authMiddleware, async (req, res) => {
  console.log('[Student API] POST /roadmap/submit - User:', req.user._id, 'Body:', req.body);
  try {
    const { nodeId, score, answers } = req.body;
    
    if (!nodeId || score === undefined) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    let progress = await StudentProgress.findOne({ studentId: req.user._id });
    console.log('[Student API] Progress found:', !!progress);
    if (!progress) {
      return res.status(404).json({ message: 'Nem található előrehaladás' });
    }

    // Find and update the node
    const node = progress.roadmap.id(nodeId);
    if (!node) {
      return res.status(404).json({ message: 'Node nem található' });
    }

    node.score = score;
    node.status = 'completed';
    node.completedAt = new Date();
    node.attempts += 1;

    // Calculate XP based on score
    const baseXP = 50;
    const scoreBonus = Math.floor(score * 0.5);
    const firstTryBonus = node.attempts === 1 ? 25 : 0;
    const totalXP = baseXP + scoreBonus + firstTryBonus;

    progress.addXP(totalXP);

    // Check for fast-track (score > 90%)
    if (score > 90) {
      // Unlock next 2 nodes if they exist
      const currentIndex = progress.roadmap.findIndex(n => n.nodeId === nodeId);
      for (let i = 1; i <= 2; i++) {
        const nextNode = progress.roadmap[currentIndex + i];
        if (nextNode && !nextNode.isExtraPractice) {
          nextNode.status = 'unlocked';
        }
      }
    }

    // Check for extra practice needed (score < 60%)
    if (score < 60) {
      const currentNode = progress.roadmap.find(n => n.nodeId === nodeId);
      // Generate extra practice nodes based on subject
      const extraNodes = generateExtraPracticeNodes(currentNode.subject, nodeId);
      progress.roadmap.push(...extraNodes);
    }

    // Check and award badges
    const newBadges = progress.checkBadges();

    await progress.save();
    console.log('[Student API] Progress saved successfully');

    res.json({
      message: 'Sikeresen beküldve',
      xpEarned: totalXP,
      newBadges,
      totalXP: progress.totalXP,
      streak: progress.streak
    });
  } catch (error) {
    console.error('[Student API] Error in /roadmap/submit:', error);
    res.status(500).json({ message: 'Hiba történt a beküldéskor', error: error.message });
  }
});

// GET /api/student/chat/history - Chat előzmények lekérése
router.get('/chat/history', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /chat/history - User:', req.user._id);
  try {
    let chatHistory = await StudentChatHistory.findOne({ studentId: req.user._id })
      .populate('studentId', 'name className');
    console.log('[Student API] Chat history found:', !!chatHistory);
    
    if (!chatHistory) {
      return res.json({ messages: [], sessions: [] });
    }

    const currentSession = chatHistory.getCurrentSession();
    const recentMessages = chatHistory.getRecentMessages(50);

    res.json({
      messages: recentMessages,
      currentSessionId: chatHistory.currentSessionId,
      sessions: chatHistory.sessions.map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        updatedAt: s.updatedAt
      }))
    });
  } catch (error) {
    console.error('[Student API] Error in /chat/history:', error);
    res.status(500).json({ message: 'Hiba történt a chat előzmények lekérésekor', error: error.message });
  }
});

// POST /api/student/chat/send - Chat üzenet küldése
router.post('/chat/send', authMiddleware, async (req, res) => {
  console.log('[Student API] POST /chat/send - User:', req.user._id, 'Message:', req.body?.message?.substring(0, 50));
  try {
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Üzenet szükséges' });
    }

    // Get or create chat history
    let chatHistory = await StudentChatHistory.findOne({ studentId: req.user._id });
    if (!chatHistory) {
      chatHistory = new StudentChatHistory({ studentId: req.user._id });
    }

    // Add user message
    chatHistory.addMessage('user', message);

    // Get student context for AI prompt
    const studentContext = await buildStudentContext(req.user._id);

    // Get recent messages for context
    const recentMessages = chatHistory.getRecentMessages(10);

    // Generate AI response (placeholder - integrate with Groq/LLM)
    const aiResponse = await generateAIResponse(message, studentContext, recentMessages);

    // Add AI response
    chatHistory.addMessage('assistant', aiResponse);

    // Cleanup old sessions
    await chatHistory.cleanupOldSessions(10);

    await chatHistory.save();

    console.log('[Student API] Chat message processed successfully');
    res.json({ 
      message: aiResponse,
      sessionId: chatHistory.currentSessionId
    });
  } catch (error) {
    console.error('[Student API] Error in /chat/send:', error);
    res.status(500).json({ message: 'Hiba történt a chat üzenet feldolgozása során', error: error.message });
  }
});

// ==================== DIAGNOSZTIKAI TESZT VÉGPONTOK ====================

// GET /api/student/diagnostic/start/:subject - Diagnosztikai teszt indítása
router.get('/diagnostic/start/:subject', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /diagnostic/start - User:', req.user._id, 'Subject:', req.params.subject);
  try {
    const { subject } = req.params;
    
    // Ellenőrizd, hogy a tantárgy támogatott-e
    const validSubjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    if (!validSubjects.includes(subject)) {
      return res.status(400).json({ message: 'Érvénytelen tantárgy' });
    }

    // Ellenőrizd, hogy már nem végezte-e el a tesztet
    const existingResult = await DiagnosticResult.findOne({
      studentId: req.user._id,
      subject,
      status: { $ne: 'in_progress' }
    });

    if (existingResult) {
      return res.status(400).json({ 
        message: 'Már elvégezted ezt a diagnosztikai tesztet',
        alreadyCompleted: true,
        resultId: existingResult._id
      });
    }

    // Ellenőrizd, hogy van-e folyamatban lévő teszt
    const inProgressTest = await DiagnosticResult.findOne({
      studentId: req.user._id,
      subject,
      status: 'in_progress'
    });

    if (inProgressTest) {
      // Folytasd a meglévő tesztet
      const questions = await DiagnosticTest.find({ _id: { $in: inProgressTest.answers.map(a => a.questionId) } });
      return res.json({
        testId: inProgressTest._id,
        questions,
        resumed: true,
        totalQuestions: 20
      });
    }

    // Generálj új tesztet (fix 20 kérdés)
    const questions = await DiagnosticTest.generateDiagnosticTest(subject, 20);
    
    if (questions.length < 20) {
      console.log('[Student API] Not enough questions available:', questions.length);
      // Próbálj meg több kérdést találni
      const additionalQuestions = await DiagnosticTest.find({ subject })
        .sort({ difficulty: 1 })
        .limit(20 - questions.length);
      
      // Szűrd ki a már benne lévőket
      const existingIds = questions.map(q => q._id.toString());
      const newQuestions = additionalQuestions.filter(q => !existingIds.includes(q._id.toString()));
      questions.push(...newQuestions);
    }

    // Hozd létre a teszt eredményt
    const result = await DiagnosticResult.startDiagnosticTest(req.user._id, subject, questions[0]._id);
    
    // Mentsd el a kérdéseket a teszthez (a teszt ID-je megegyezik az első kérdésével)
    result.testId = questions[0]._id; // Ez egy kicsit hack, de működik
    await result.save();

    console.log('[Student API] Diagnostic test started:', result._id);
    
    // Keverd össze a kérdéseket
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5).slice(0, 20);

    res.json({
      testId: result._id,
      questions: shuffledQuestions,
      totalQuestions: 20,
      subject
    });
  } catch (error) {
    console.error('[Student API] Error in /diagnostic/start:', error);
    res.status(500).json({ message: 'Hiba történt a teszt indításakor', error: error.message });
  }
});

// POST /api/student/diagnostic/submit - Diagnosztikai teszt válaszainak beküldése
router.post('/diagnostic/submit', authMiddleware, async (req, res) => {
  console.log('[Student API] POST /diagnostic/submit - User:', req.user._id);
  try {
    const { testId, answers } = req.body;
    
    if (!testId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    // Keresd meg a tesztet
    const result = await DiagnosticResult.findById(testId);
    if (!result) {
      return res.status(404).json({ message: 'Teszt nem található' });
    }

    // Ellenőrizd, hogy a diáké-e
    if (result.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Nincs jogosultság' });
    }

    // Ellenőrizd, hogy már nincs-e beküldve
    if (result.status !== 'in_progress') {
      return res.status(400).json({ message: 'A teszt már be lett küldve' });
    }

    // Töltsd be a kérdéseket
    const questionIds = answers.map(a => a.questionId);
    const questions = await DiagnosticTest.find({ _id: { $in: questionIds } });

    // Értékeld ki a válaszokat
    const evaluatedAnswers = answers.map(answer => {
      const question = questions.find(q => q._id.toString() === answer.questionId);
      if (!question) return null;

      let isCorrect = false;
      let points = 0;

      // Értékelés kérdéstípus szerint
      switch (question.questionType) {
        case 'multiple_choice':
          isCorrect = answer.answer === question.correctAnswer;
          points = isCorrect ? question.points : 0;
          break;
        case 'true_false':
          isCorrect = answer.answer === question.correctAnswer;
          points = isCorrect ? question.points : 0;
          break;
        case 'short_answer':
          // Egyszerű egyezés (kis-nagybetű érzéketlen)
          const studentAnswer = answer.answer.toLowerCase().trim();
          const correctAnswer = question.correctAnswer.toLowerCase().trim();
          isCorrect = studentAnswer === correctAnswer || studentAnswer.includes(correctAnswer);
          points = isCorrect ? question.points : 0;
          break;
        case 'matching':
          // Párosítás értékelése
          const studentPairs = answer.answer;
          const correctPairs = question.correctAnswer;
          const correctMatches = studentPairs.filter(pair => {
            return correctPairs.some(cp => cp.left === pair.left && cp.right === pair.right);
          });
          isCorrect = correctMatches.length === correctPairs.length;
          points = (correctMatches.length / correctPairs.length) * question.points;
          break;
      }

      return {
        questionId: question._id,
        studentAnswer: answer.answer,
        isCorrect,
        points,
        timeSpent: answer.timeSpent || 0
      };
    }).filter(a => a !== null);

    // Add answers to result
    evaluatedAnswers.forEach(answer => {
      result.addAnswer(
        answer.questionId,
        answer.studentAnswer,
        answer.isCorrect,
        answer.points,
        answer.timeSpent
      );
    });

    // Fejezd be a tesztet
    result.completeTest();
    
    // Indítsd el az AI elemzést
    const analyzedResult = await DiagnosticResult.analyzeResults(result._id);

    // Generálj személyre szabott roadmap-et az eredmények alapján
    await generatePersonalizedRoadmap(req.user._id, analyzedResult);

    console.log('[Student API] Diagnostic test submitted and analyzed:', testId);

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

// GET /api/student/diagnostic/result/:id - Diagnosztikai teszt eredménye
router.get('/diagnostic/result/:id', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /diagnostic/result - User:', req.user._id, 'ResultId:', req.params.id);
  try {
    const result = await DiagnosticResult.findById(req.params.id)
      .populate('answers.questionId');
    
    if (!result) {
      return res.status(404).json({ message: 'Eredmény nem található' });
    }

    // Ellenőrizd, hogy a diáké-e
    if (result.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Nincs jogosultság' });
    }

    res.json({
      subject: result.subject,
      score: result.scorePercentage,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correctAnswers,
      categoryAnalysis: result.categoryAnalysis,
      aiAnalysis: result.aiAnalysis,
      completedAt: result.completedAt
    });
  } catch (error) {
    console.error('[Student API] Error in /diagnostic/result:', error);
    res.status(500).json({ message: 'Hiba történt az eredmény lekérésekor', error: error.message });
  }
});

// GET /api/student/diagnostic/status/:subject - Diagnosztikai teszt státusza
router.get('/diagnostic/status/:subject', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /diagnostic/status - User:', req.user._id, 'Subject:', req.params.subject);
  try {
    const { subject } = req.params;
    
    const result = await DiagnosticResult.findOne({
      studentId: req.user._id,
      subject
    }).sort({ completedAt: -1 });

    if (!result) {
      return res.json({ status: 'not_started' });
    }

    res.json({
      status: result.status === 'in_progress' ? 'in_progress' : 'completed',
      score: result.scorePercentage,
      completedAt: result.completedAt
    });
  } catch (error) {
    console.error('[Student API] Error in /diagnostic/status:', error);
    res.status(500).json({ message: 'Hiba történt a státusz lekérésekor', error: error.message });
  }
});

// POST /api/student/tutor/hint - Szókratészi AI tutor tipp
router.post('/tutor/hint', authMiddleware, async (req, res) => {
  console.log('[Student API] POST /tutor/hint - User:', req.user._id);
  try {
    const { subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber, tone } = req.body;
    
    if (!subject || !topic || !questionText || !studentAnswer || !correctAnswer) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    // Generálj szókratészi tippet
    const hint = await groqService.generateSocraticHint(
      subject,
      topic,
      questionText,
      studentAnswer,
      correctAnswer,
      attemptNumber || 1,
      tone || 'teacher'
    );

    res.json({ hint });
  } catch (error) {
    console.error('[Student API] Error in /tutor/hint:', error);
    res.status(500).json({ message: 'Hiba történt a tipp generálásakor', error: error.message });
  }
});

// POST /api/student/tutor/question - Gyakorló kérdés generálása egy témakörből
router.post('/tutor/question', authMiddleware, async (req, res) => {
  try {
    const { subject, topic } = req.body;
    if (!subject || !topic) {
      return res.status(400).json({ message: 'Tantárgy és témakör szükséges' });
    }
    const question = await groqService.generatePracticeQuestion(subject, topic);
    res.json(question);
  } catch (error) {
    console.error('[Student API] Error in /tutor/question:', error);
    res.status(500).json({ message: 'Hiba történt a kérdés generálásakor', error: error.message });
  }
});

// POST /api/student/tutor/check - Diák válaszának ellenőrzése
router.post('/tutor/check', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, questionText, questionType, studentAnswer, correctAnswer, attemptNumber, tone } = req.body;
    if (!studentAnswer || !correctAnswer) {
      return res.status(400).json({ message: 'Hiányos adatok' });
    }

    let isCorrect = false;

    if (questionType === 'shorttext') {
      const result = await groqService.checkShortTextAnswer(subject, questionText, studentAnswer, correctAnswer);
      isCorrect = result.correct;
    } else {
      // MCQ és igaz/hamis: normalizált összehasonlítás
      const norm = (s) => String(s).toLowerCase().trim().replace(/[.,!?]/g, '');
      isCorrect = norm(studentAnswer) === norm(correctAnswer);
    }

    if (isCorrect) {
      const praiseMessages = [
        'Szuper! Tökéletesen megoldottad! 🎉',
        'Kiváló munka! Pontosan jól gondolkodtál! ⭐',
        'Helyes! Látszik, hogy jól értesz hozzá! 💪',
        'Brávó! Ez a helyes válasz! 🌟'
      ];
      const message = praiseMessages[Math.floor(Math.random() * praiseMessages.length)];
      return res.json({ correct: true, message });
    } else {
      const hint = await groqService.generateSocraticHint(
        subject || '',
        topic || '',
        questionText || '',
        studentAnswer,
        correctAnswer,
        attemptNumber || 1,
        tone || 'teacher'
      );
      return res.json({ correct: false, hint });
    }
  } catch (error) {
    console.error('[Student API] Error in /tutor/check:', error);
    res.status(500).json({ message: 'Hiba történt az ellenőrzés során', error: error.message });
  }
});

// GET /api/student/diagnostic/statuses - Összes diagnosztikai teszt státusza
router.get('/diagnostic/statuses', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /diagnostic/statuses - User:', req.user._id);
  try {
    const subjects = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
    const statuses = {};

    for (const subject of subjects) {
      const result = await DiagnosticResult.findOne({
        studentId: req.user._id,
        subject
      }).sort({ completedAt: -1 });

      if (result) {
        statuses[subject] = {
          status: result.status === 'in_progress' ? 'in_progress' : 'completed',
          score: result.scorePercentage,
          completedAt: result.completedAt
        };
      } else {
        statuses[subject] = { status: 'not_started' };
      }
    }

    res.json(statuses);
  } catch (error) {
    console.error('[Student API] Error in /diagnostic/statuses:', error);
    res.status(500).json({ message: 'Hiba történt a státuszok lekérésekor', error: error.message });
  }
});

// ==================== SEGÉDFÜGGVÉNYEK ====================

// Személyre szabott roadmap generálása a diagnosztikai eredmény alapján
async function generatePersonalizedRoadmap(studentId, diagnosticResult) {
  let progress = await StudentProgress.findOne({ studentId });
  
  if (!progress) {
    progress = new StudentProgress({
      studentId,
      roadmap: []
    });
  }

  // Töröld a régi roadmap-et (vagy tartsd meg, ha folytatás)
  progress.roadmap = [];

  // Generálj node-okat a gyengeségek alapján
  const weaknesses = diagnosticResult.aiAnalysis?.weaknesses || [];
  const strengths = diagnosticResult.aiAnalysis?.strengths || [];
  const subject = diagnosticResult.subject;

  let nodeId = 1;

  // Első: alap node-ok a gyenge területekből (több node)
  for (const weakness of weaknesses) {
    const nodeCount = weakness.priority <= 2 ? 3 : 2; // Magas prioritású gyengeségekből több node
    
    for (let i = 0; i < nodeCount; i++) {
      progress.roadmap.push({
        nodeId: `diag_node_${nodeId++}`,
        subject,
        topic: weakness.category,
        status: i === 0 ? 'unlocked' : 'locked',
        score: 0,
        isExtraPractice: true,
        difficulty: weakness.priority
      });
    }
  }

  // Második: ismétlő node-ok az erősségekből (kevesebb node)
  for (const strength of strengths) {
    progress.roadmap.push({
      nodeId: `diag_node_${nodeId++}`,
      subject,
      topic: strength.category,
      status: 'locked',
      score: 0,
      isExtraPractice: false
    });
  }

  // Harmadik: Mini-Boss node (szakasz-záró kihívás)
  if (progress.roadmap.length > 0) {
    progress.roadmap.push({
      nodeId: `diag_boss_${nodeId++}`,
      subject,
      topic: `${subject} - Kihívás`,
      status: 'locked',
      score: 0,
      isExtraPractice: false,
      isBoss: true
    });
  }

  // Negyedik: végső cél node (90% kompetencia elérése)
  progress.roadmap.push({
    nodeId: `diag_final_${nodeId++}`,
    subject,
    topic: `${subject} - Mesterfok`,
    status: 'locked',
    score: 0,
    isExtraPractice: false,
    isFinalGoal: true,
    targetScore: 90
  });

  await progress.save();
  console.log('[Student API] Personalized roadmap generated for student:', studentId);
  
  return progress;
}

// GET /api/student/statistics - Diák statisztikák
router.get('/statistics', authMiddleware, async (req, res) => {
  console.log('[Student API] GET /statistics - User:', req.user._id);
  try {
    const progress = await StudentProgress.findOne({ studentId: req.user._id });
    console.log('[Student API] Progress found:', !!progress);
    const user = req.user;

    // Get assignment statistics - populate the assignments reference
    const completedAssignments = user.assignments.filter(a => a.completedAt);
    const totalPoints = completedAssignments.reduce((sum, a) => sum + (a.achievedPoints || 0), 0);
    
    // Calculate average score from completed assignments
    let averageScore = 0;
    if (completedAssignments.length > 0) {
      const scores = completedAssignments.map(a => {
        const assignment = a.assignments;
        if (assignment && assignment.totalPoints > 0) {
          return (a.achievedPoints / assignment.totalPoints) * 100;
        }
        return 0;
      });
      const validScores = scores.filter(s => s > 0);
      averageScore = validScores.length > 0 
        ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length 
        : 0;
    }

    // Calculate topic-level statistics
    const topicStats = calculateTopicStatistics(completedAssignments);

    // Get strengths and weaknesses
    const strengths = topicStats
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 3);
    
    const weaknesses = topicStats
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 3);

    console.log('[Student API] Statistics calculated successfully');
    res.json({
      totalXP: progress?.totalXP || 0,
      streak: progress?.streak || 0,
      badges: progress?.badges || [],
      averageScore: Math.round(averageScore),
      completedAssignments: completedAssignments.length,
      totalAssignments: user.assignments.length,
      topicStats,
      strengths,
      weaknesses,
      dailyGoal: progress?.dailyGoal || 100,
      dailyProgress: calculateDailyProgress(progress)
    });
  } catch (error) {
    console.error('[Student API] Error in /statistics:', error);
    res.status(500).json({ message: 'Hiba történt a statisztikák lekérésekor', error: error.message });
  }
});

// Helper functions
function generateInitialRoadmap(className) {
  // Generate initial roadmap based on class level
  const subjects = ['Matematika', 'Magyar', 'Angol', 'Természetismeret'];
  const topics = {
    'Matematika': ['Algebra', 'Geometria', 'Függvények', 'Statisztika'],
    'Magyar': ['Nyelvtan', 'Irodalom', 'Fogalmazás', 'Helyesírás'],
    'Angol': ['Szókincs', 'Nyelvtan', 'Olvasás', 'Írás'],
    'Természetismeret': ['Fizika', 'Kémia', 'Biológia', 'Földrajz']
  };

  const roadmap = [];
  let nodeId = 1;

  subjects.forEach((subject, subjectIndex) => {
    topics[subject].forEach((topic, topicIndex) => {
      roadmap.push({
        nodeId: `node_${nodeId++}`,
        subject,
        topic,
        status: subjectIndex === 0 && topicIndex === 0 ? 'unlocked' : 'locked',
        score: 0,
        isExtraPractice: false
      });
    });
  });

  return roadmap;
}

function generateExtraPracticeNodes(subject, parentNodeId) {
  // Generate extra practice nodes based on weak performance
  const practiceTopics = {
    'Matematika': ['Alapműveletek', 'Törtek', 'Százalékszámítás'],
    'Magyar': ['Igeidők', 'Mondattan', 'Szófajok'],
    'Angol': ['Basic Grammar', 'Vocabulary', 'Reading Comprehension'],
    'Természetismeret': ['Alapfogalmak', 'Mértékegységek', 'Tudományos módszer']
  };

  const topics = practiceTopics[subject] || ['Alapok'];
  
  return topics.slice(0, 2).map((topic, index) => ({
    nodeId: `extra_${parentNodeId}_${index + 1}`,
    subject,
    topic,
    status: 'unlocked',
    score: 0,
    isExtraPractice: true
  }));
}

async function buildStudentContext(studentId) {
  const user = await User.findById(studentId);
  const progress = await StudentProgress.findOne({ studentId });
  
  // Get upcoming assignments
  const upcomingAssignments = await Assignment.find({
    dueDate: { $gte: new Date() },
    'assignedClasses.className': user.className
  }).sort({ dueDate: 1 }).limit(3);

  return {
    name: user.name,
    className: user.className,
    upcomingAssignments: upcomingAssignments.map(a => ({
      title: a.title,
      dueDate: a.dueDate,
      subject: a.subject
    })),
    recentPerformance: progress ? {
      totalXP: progress.totalXP,
      streak: progress.streak,
      averageScore: calculateAverageScore(user.assignments)
    } : null
  };
}

async function generateAIResponse(userMessage, studentContext, recentMessages) {
  // Placeholder AI response generator
  // In production, this would call Groq API with LLaMA model
  
  const lowerMessage = userMessage.toLowerCase();
  
  // Simple response logic based on keywords
  if (lowerMessage.includes('dolgozat') || lowerMessage.includes('feladat')) {
    if (studentContext.upcomingAssignments.length > 0) {
      return `A közelgő dolgozataid:\n\n${studentContext.upcomingAssignments.map(a => 
        `📝 **${a.title}** (${a.subject})\n   Határidő: ${new Date(a.dueDate).toLocaleDateString('hu-HU')}`
      ).join('\n\n')}\n\nNe felejtsd el időben felkészülni! 💪`;
    } else {
      return 'Jelenleg nincsenek közelgő dolgozataid. Használd ezt az időt ismétlésre! 📚';
    }
  }
  
  if (lowerMessage.includes('segítség') || lowerMessage.includes('nem értem')) {
    return 'Szívesen segítek! 😊 Melyik témakörben szeretnél gyakorolni? Tudok segíteni:\n\n• Matematika (algebra, geometria)\n• Magyar (nyelvtan, irodalom)\n• Angol (nyelvtan, szókincs)\n• Természetismeret\n\nVálassz egyet, és kezdjük a gyakorlást! 🚀';
  }
  
  if (lowerMessage.includes('statisztika') || lowerMessage.includes('eredmény')) {
    return `A jelenlegi statisztikáid:\n\n⭐ Összes XP: ${studentContext.recentPerformance?.totalXP || 0}\n🔥 Streak: ${studentContext.recentPerformance?.streak || 0} nap\n📊 Átlagos pontszám: ${studentContext.recentPerformance?.averageScore || 0}%\n\nFolytasd a jó munkát! Minden nap számít! 💪`;
  }
  
  // Default encouraging response
  return 'Köszönöm a kérdést! 😊 Mint a személyes AI tanárod, segítek a tanulásban. Kérdezz bátran bármilyen tantárggyal kapcsolatban, vagy kérj gyakorló feladatokat! 📚✨\n\nMiben segíthetek ma?';
}

function calculateTopicStatistics(assignments) {
  // Placeholder - would analyze assignment topics
  return [
    { topic: 'Algebra', averageScore: 75, count: 5 },
    { topic: 'Geometria', averageScore: 82, count: 3 },
    { topic: 'Nyelvtan', averageScore: 68, count: 4 }
  ];
}

function calculateAverageScore(assignments) {
  if (!assignments || assignments.length === 0) return 0;
  
  const totalScore = assignments.reduce((sum, a) => {
    const percentage = (a.achievedPoints / a.assignments?.totalPoints) * 100;
    return sum + percentage;
  }, 0);
  
  return Math.round(totalScore / assignments.length);
}

function calculateDailyProgress(progress) {
  if (!progress) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // This would track daily XP earned
  // For now, return a placeholder
  return Math.min(progress.totalXP % progress.dailyGoal, progress.dailyGoal);
}

module.exports = router;