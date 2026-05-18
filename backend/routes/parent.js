const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProgress = require('../models/StudentProgress');
const ParentChatHistory = require('../models/ParentChatHistory');
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const DiagnosticResult = require('../models/DiagnosticResult');
const ParentGoal = require('../models/ParentGoal');
const groqService = require('../services/aiService');
const authenticateUser = require('../middleware/authenticateUser');

// Szülői jogosultság ellenőrzése middleware
const authenticateParent = [
  authenticateUser,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      if (!user || user.role !== 'parent') {
        return res.status(403).json({ message: 'Csak szülők férhetnek hozzá ehhez a végponthoz.' });
      }
      req.parentUser = user;
      next();
    } catch (err) {
      console.error('[Parent API] Auth middleware error:', err);
      res.status(500).json({ message: 'Belső hiba a szülői autentikáció során.' });
    }
  }
];

// GET /api/parent/children - Kapcsolt gyermekek lekérése
router.get('/children', authenticateParent, async (req, res) => {
  try {
    const parent = await User.findById(req.userId).populate('children', 'name email className');
    res.json({ children: parent.children || [] });
  } catch (error) {
    console.error('[Parent API] Get children error:', error);
    res.status(500).json({ message: 'Hiba a gyermekek lekérésekor.' });
  }
});

// POST /api/parent/children/add - Gyermek hozzáadása e-mail alapján
router.post('/children/add', authenticateParent, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Az e-mail cím megadása kötelező.' });
    }

    const child = await User.findOne({ email: email.toLowerCase().trim(), role: 'student' });
    if (!child) {
      return res.status(404).json({ message: 'A megadott e-mail címmel nem található aktív diák.' });
    }

    const parent = req.parentUser;
    if (parent.children.includes(child._id)) {
      return res.status(400).json({ message: 'Ez a gyermek már hozzá van rendelve a fiókodhoz.' });
    }

    parent.children.push(child._id);
    await parent.save();

    res.json({ message: 'Gyermek sikeresen hozzárendelve.', child: { _id: child._id, name: child.name, email: child.email, className: child.className } });
  } catch (error) {
    console.error('[Parent API] Add child error:', error);
    res.status(500).json({ message: 'Hiba a gyermek hozzárendelése során.' });
  }
});

// POST /api/parent/children/remove - Gyermek eltávolítása
router.post('/children/remove', authenticateParent, async (req, res) => {
  try {
    const { childId } = req.body;
    if (!childId) {
      return res.status(400).json({ message: 'A gyermek azonosító megadása kötelező.' });
    }

    const parent = req.parentUser;
    parent.children = parent.children.filter(id => id.toString() !== childId);
    await parent.save();

    res.json({ message: 'Gyermek sikeresen eltávolítva.' });
  } catch (error) {
    console.error('[Parent API] Remove child error:', error);
    res.status(500).json({ message: 'Hiba a gyermek eltávolítása során.' });
  }
});

// GET /api/parent/child/:childId/overview - Gyermek áttekintő adatai (XP, Streak, átlag, alert-ek)
router.get('/child/:childId/overview', authenticateParent, async (req, res) => {
  try {
    const { childId } = req.params;
    const parent = req.parentUser;

    if (!parent.children.includes(childId)) {
      return res.status(403).json({ message: 'Nincs jogosultsága ennek a gyermeknek az adataihoz.' });
    }

    const child = await User.findById(childId);
    if (!child) return res.status(404).json({ message: 'Gyermek nem található.' });

    // XP és Streak lekérése
    const progress = await StudentProgress.findOne({ studentId: childId });
    const totalXP = progress ? progress.totalXP : 0;
    const streak = progress ? progress.getEffectiveStreak() : 0;

    // Átlag számolása (csak a véglegesített dolgozatokból)
    const completedAssignments = child.assignments.filter(a => !a.isDraft && a.grade !== null);
    const averageGrade = completedAssignments.length > 0
      ? (completedAssignments.reduce((sum, a) => sum + a.grade, 0) / completedAssignments.length).toFixed(2)
      : '—';

    // Aktív dolgozatok
    const activeAssignments = await Assignment.find({
      className: child.className,
      studentIds: childId
    });

    const alerts = [];
    const now = new Date();

    // 1. Határidő alert (48 órán belül lejáró dolgozatok, amik nincsenek véglegesen kész)
    const completedIds = child.assignments.filter(a => !a.isDraft).map(a => a.assignmentId.toString());
    activeAssignments.forEach(a => {
      if (!completedIds.includes(a._id.toString()) && a.dueDate) {
        const dueDate = new Date(a.dueDate);
        const diffHrs = (dueDate - now) / (1000 * 60 * 60);
        if (diffHrs > 0 && diffHrs <= 48) {
          alerts.push({
            type: 'deadline',
            title: `Közelgő határidő: ${a.title}`,
            message: `A dolgozat határideje: ${dueDate.toLocaleString('hu-HU')}`,
            meta: { assignmentId: a._id, dueDate: a.dueDate }
          });
        }
      }
    });

    // 2. Új értékelés alert (az elmúlt 72 órában javított vagy feltöltött osztályzatok)
    completedAssignments.forEach(a => {
      if (a.completedAt) {
        const completedAt = new Date(a.completedAt);
        const diffHrs = (now - completedAt) / (1000 * 60 * 60);
        if (diffHrs <= 72) {
          const match = activeAssignments.find(asg => asg._id.toString() === a.assignmentId.toString());
          alerts.push({
            type: 'grade',
            title: `Új érdemjegy: ${match ? match.title : 'Dolgozat'}`,
            message: `Sikeresen lezárva: ${a.grade}-es érdemjeggyel! (${a.achievedPoints} pont)`,
            meta: { assignmentId: a.assignmentId, grade: a.grade }
          });
        }
      }
    });

    res.json({
      child: {
        _id: child._id,
        name: child.name,
        email: child.email,
        className: child.className
      },
      stats: {
        totalXP,
        streak,
        averageGrade,
        completedCount: completedAssignments.length
      },
      alerts
    });
  } catch (error) {
    console.error('[Parent API] Child overview error:', error);
    res.status(500).json({ message: 'Hiba az áttekintő lekérésekor.' });
  }
});

// GET /api/parent/child/:childId/assignments - Gyermek teendőinek listája (passzív tükrözés)
router.get('/child/:childId/assignments', authenticateParent, async (req, res) => {
  try {
    const { childId } = req.params;
    const parent = req.parentUser;

    if (!parent.children.includes(childId)) {
      return res.status(403).json({ message: 'Nincs jogosultsága ennek a gyermeknek az adataihoz.' });
    }

    const child = await User.findById(childId);
    if (!child) return res.status(404).json({ message: 'Gyermek nem található.' });

    // Lekérjük a diák osztályához tartozó dolgozatokat
    const assignments = await Assignment.find({
      className: child.className,
      studentIds: childId
    }).sort({ dueDate: 1 });

    const taskList = assignments.map(a => {
      const submission = child.assignments.find(sub => sub.assignmentId.toString() === a._id.toString());
      let status = 'not_started';
      if (submission) {
        status = submission.isDraft ? 'started' : 'completed';
      }

      return {
        _id: a._id,
        title: a.title,
        subject: a.subject,
        dueDate: a.dueDate,
        totalPoints: a.totalPoints,
        status, // 'not_started', 'started', 'completed'
        completedAt: submission ? submission.completedAt : null,
        grade: submission && !submission.isDraft ? submission.grade : null,
        achievedPoints: submission ? submission.achievedPoints : null
      };
    });

    res.json({ assignments: taskList });
  } catch (error) {
    console.error('[Parent API] Child assignments error:', error);
    res.status(500).json({ message: 'Hiba a teendők lekérésekor.' });
  }
});

// GET /api/parent/child/:childId/results - Gyermek lezárt eredményei (passzív archívum)
router.get('/child/:childId/results', authenticateParent, async (req, res) => {
  try {
    const { childId } = req.params;
    const parent = req.parentUser;

    if (!parent.children.includes(childId)) {
      return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
    }

    const child = await User.findById(childId);
    if (!child) return res.status(404).json({ message: 'Gyermek nem található.' });

    // Szűrés a véglegesített dolgozatokra
    const completedSubmissions = child.assignments.filter(a => !a.isDraft);

    const results = [];
    for (const sub of completedSubmissions) {
      const match = await Assignment.findById(sub.assignmentId);
      if (match) {
        results.push({
          assignmentId: sub.assignmentId,
          title: match.title,
          subject: match.subject,
          totalPoints: match.totalPoints,
          achievedPoints: sub.achievedPoints,
          suggestedGrade: sub.suggestedGrade,
          grade: sub.grade,
          completedAt: sub.completedAt,
          answers: sub.answers.map(ans => {
            const questionMatch = match.questions.find(q => q._id.toString() === ans.questionId.toString());
            return {
              questionId: ans.questionId,
              questionText: questionMatch ? questionMatch.questionText : 'Ismeretlen kérdés',
              questionType: questionMatch ? questionMatch.questionType : 'short_answer',
              studentAnswer: ans.studentAnswer,
              correctAnswer: questionMatch ? questionMatch.correctAnswer : null,
              score: ans.score,
              maxPoints: questionMatch ? questionMatch.points : 0,
              aiFeedback: ans.aiFeedback,
              flagged: ans.flagged,
              flagResponse: ans.flagResponse,
              flagRejected: ans.flagRejected
            };
          })
        });
      }
    }

    res.json({ results: results.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)) });
  } catch (error) {
    console.error('[Parent API] Child results error:', error);
    res.status(500).json({ message: 'Hiba az eredmények lekérésekor.' });
  }
});

// GET /api/parent/child/:childId/results/:assignmentId - Gyermek egy konkrét lezárt eredménye
router.get('/child/:childId/results/:assignmentId', authenticateParent, async (req, res) => {
  try {
    const { childId, assignmentId } = req.params;
    const parent = req.parentUser;

    if (!parent.children.includes(childId)) {
      return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
    }

    const child = await User.findById(childId);
    if (!child) return res.status(404).json({ message: 'Gyermek nem található.' });

    const sub = child.assignments.find(a => a.assignmentId.toString() === assignmentId.toString() && !a.isDraft);
    if (!sub) return res.status(404).json({ message: 'A megadott dolgozat nem található a gyermek befejezett dolgozatai között.' });

    const match = await Assignment.findById(sub.assignmentId);
    if (!match) return res.status(404).json({ message: 'A dolgozat sablonja nem található.' });

    const result = {
      assignmentId: sub.assignmentId,
      title: match.title,
      subject: match.subject,
      totalPoints: match.totalPoints,
      achievedPoints: sub.achievedPoints,
      suggestedGrade: sub.suggestedGrade,
      grade: sub.grade,
      completedAt: sub.completedAt,
      answers: sub.answers.map(ans => {
        const questionMatch = match.questions.find(q => q._id.toString() === ans.questionId.toString());
        return {
          questionId: ans.questionId,
          questionText: questionMatch ? questionMatch.questionText : 'Ismeretlen kérdés',
          questionType: questionMatch ? questionMatch.questionType : 'short_answer',
          studentAnswer: ans.studentAnswer,
          correctAnswer: questionMatch ? questionMatch.correctAnswer : null,
          score: ans.score,
          maxPoints: questionMatch ? questionMatch.points : 0,
          aiFeedback: ans.aiFeedback,
          flagged: ans.flagged,
          flagResponse: ans.flagResponse,
          flagRejected: ans.flagRejected
        };
      })
    };

    res.json({ assignment: result });
  } catch (error) {
    console.error('[Parent API] Child result detail error:', error);
    res.status(500).json({ message: 'Hiba a dolgozat részleteinek lekérésekor.' });
  }
});

// GET /api/parent/child/:childId/roadmap/:subject - Diagnosztikai radar adatok & szülői roadmap
router.get('/child/:childId/roadmap/:subject', authenticateParent, async (req, res) => {
  try {
    const { childId, subject } = req.params;
    const parent = req.parentUser;

    if (!parent.children.includes(childId)) {
      return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
    }

    // 1. Megkeressük a gyermek útvonalát
    const progress = await StudentProgress.findOne({ studentId: childId });
    let checkpoints = [];
    let currentLevel = 1;
    let subjectXP = 0;

    if (progress) {
      const subjectData = progress.subjectProgress.find(s => s.subject === subject);
      if (subjectData) {
        checkpoints = subjectData.checkpoints || [];
        currentLevel = subjectData.currentLevel || 1;
        subjectXP = subjectData.subjectXP || 0;
      }
    }

    // 2. Megkeressük a legfrissebb befejezett szintfelmérőt
    const diagnostic = await DiagnosticResult.findOne({
      studentId: childId,
      subject,
      status: 'analyzed'
    }).sort({ completedAt: -1 });

    const radarData = diagnostic ? (diagnostic.categoryAnalysis || []).map(cat => ({
      category: cat.category,
      score: cat.score,
      totalQuestions: cat.totalQuestions,
      correctAnswers: cat.correctAnswers
    })) : [];

    const strengths = diagnostic?.aiAnalysis?.strengths || [];
    const weaknesses = diagnostic?.aiAnalysis?.weaknesses || [];
    const feedback = diagnostic?.aiAnalysis?.personalizedFeedback || (diagnostic ? 'A diagnosztikai felmérő sikeresen elemezve.' : 'Még nincs kitöltött diagnosztikai felmérő.');

    res.json({
      subject,
      currentLevel,
      subjectXP,
      checkpoints,
      radarData,
      aiAnalysis: {
        strengths,
        weaknesses,
        feedback
      }
    });
  } catch (error) {
    console.error('[Parent API] Roadmap error:', error);
    res.status(500).json({ message: 'Hiba a fejlődési térkép betöltésekor.' });
  }
});

// GET /api/parent/child/:childId/statistics
router.get('/child/:childId/statistics', authenticateParent, async (req, res) => {
  const { childId } = req.params;
  const parent = req.parentUser;
  if (!parent.children.includes(childId)) {
    return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
  }
  try {
    const [child, progress] = await Promise.all([
      User.findById(childId).populate('assignments.assignmentId', 'title totalPoints subject'),
      StudentProgress.findOne({ studentId: childId })
    ]);

    if (!child) return res.status(404).json({ message: 'Gyermek nem található.' });

    const validAssignments = child.assignments.filter(a => a.assignmentId != null);
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
    console.error('[Parent API] Child statistics error:', error);
    res.status(500).json({ message: 'Hiba a statisztikák lekérésekor.' });
  }
});

// GET /api/parent/child/:childId/practice-statistics
router.get('/child/:childId/practice-statistics', authenticateParent, async (req, res) => {
  const { childId } = req.params;
  const parent = req.parentUser;
  if (!parent.children.includes(childId)) {
    return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
  }
  try {
    const progress = await StudentProgress.findOne({ studentId: childId });
    const diagnosticResults = await DiagnosticResult.find({
      studentId: childId,
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
    console.error('[Parent API] Child practice statistics error:', error);
    res.status(500).json({ message: 'Hiba az egyéni gyakorlás statisztikák lekérésekor.' });
  }
});

// ==================== CÉLKITŰZÉSEK ====================

// GET /api/parent/child/:childId/goals - Célok lekérése haladással
router.get('/child/:childId/goals', authenticateParent, async (req, res) => {
  const { childId } = req.params;
  const parent = req.parentUser;
  if (!parent.children.includes(childId)) {
    return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
  }
  try {
    const [goalDoc, childData, progressData] = await Promise.all([
      ParentGoal.findOne({ parentId: parent._id, childId }),
      User.findById(childId).populate('assignments.assignmentId', 'subject totalPoints'),
      StudentProgress.findOne({ studentId: childId })
    ]);

    const goals = goalDoc?.goals || [];
    const streak = progressData ? progressData.getEffectiveStreak() : 0;
    const totalXP = progressData?.totalXP || 0;
    const subjectProgress = progressData?.subjectProgress || [];

    const goalsWithProgress = goals.map(goal => {
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

      return {
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
        progress: { current, target, unit, pct, count }
      };
    });

    res.json({ goals: goalsWithProgress });
  } catch (error) {
    console.error('[Parent API] Get goals error:', error);
    res.status(500).json({ message: 'Hiba a célkitűzések lekérésekor.' });
  }
});

// POST /api/parent/child/:childId/goals - Új cél hozzáadása
router.post('/child/:childId/goals', authenticateParent, async (req, res) => {
  const { childId } = req.params;
  const parent = req.parentUser;
  if (!parent.children.includes(childId)) {
    return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
  }
  try {
    const { type, subject, title, targetPercent, periodDays, targetXP, targetStreak, deadline } = req.body;
    if (!type || !subject || !title) {
      return res.status(400).json({ message: 'Hiányzó kötelező mezők (type, subject, title).' });
    }

    let startTotalXP = 0, startSubjectXP = 0;
    if (type === 'practice_xp') {
      const progress = await StudentProgress.findOne({ studentId: childId });
      if (progress) {
        startTotalXP = progress.totalXP || 0;
        if (subject !== 'all') {
          const sp = (progress.subjectProgress || []).find(s => s.subject === subject);
          startSubjectXP = sp?.subjectXP || 0;
        }
      }
    }

    let goalDoc = await ParentGoal.findOne({ parentId: parent._id, childId });
    if (!goalDoc) goalDoc = new ParentGoal({ parentId: parent._id, childId, goals: [] });

    const newGoal = {
      type,
      subject,
      title: title.substring(0, 150),
      ...(type === 'assignment_avg' && { targetPercent: Number(targetPercent), periodDays: Number(periodDays) || 7 }),
      ...(type === 'practice_xp' && { targetXP: Number(targetXP), startTotalXP, startSubjectXP }),
      ...(type === 'practice_streak' && { targetStreak: Number(targetStreak) }),
      ...(deadline && { deadline: new Date(deadline) }),
    };

    goalDoc.goals.push(newGoal);
    await goalDoc.save();

    res.status(201).json({ message: 'Cél sikeresen hozzáadva.' });
  } catch (error) {
    console.error('[Parent API] Create goal error:', error);
    res.status(500).json({ message: 'Hiba a cél létrehozásakor.' });
  }
});

// DELETE /api/parent/child/:childId/goals/:goalId - Cél törlése
router.delete('/child/:childId/goals/:goalId', authenticateParent, async (req, res) => {
  const { childId, goalId } = req.params;
  const parent = req.parentUser;
  if (!parent.children.includes(childId)) {
    return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
  }
  try {
    const goalDoc = await ParentGoal.findOne({ parentId: parent._id, childId });
    if (!goalDoc) return res.status(404).json({ message: 'Nincs célkitűzés dokumentum.' });

    const idx = goalDoc.goals.findIndex(g => g._id.toString() === goalId);
    if (idx === -1) return res.status(404).json({ message: 'A cél nem található.' });

    goalDoc.goals.splice(idx, 1);
    await goalDoc.save();

    res.json({ message: 'Cél törölve.' });
  } catch (error) {
    console.error('[Parent API] Delete goal error:', error);
    res.status(500).json({ message: 'Hiba a cél törlése során.' });
  }
});

// POST /api/parent/settings/notifications - Szülői értesítési beállítások módosítása
router.post('/settings/notifications', authenticateParent, async (req, res) => {
  try {
    const { notifyLowGrade, lowGradeThreshold, notifyUpcomingDeadline, deadlineThresholdHours } = req.body;
    const parent = req.parentUser;

    parent.parentSettings = {
      notifyLowGrade: !!notifyLowGrade,
      lowGradeThreshold: Number(lowGradeThreshold) || 3,
      notifyUpcomingDeadline: !!notifyUpcomingDeadline,
      deadlineThresholdHours: Number(deadlineThresholdHours) || 24
    };

    await parent.save();
    res.json({ message: 'Értesítési beállítások sikeresen elmentve.', settings: parent.parentSettings });
  } catch (error) {
    console.error('[Parent API] Save notifications settings error:', error);
    res.status(500).json({ message: 'Hiba a beállítások mentésekor.' });
  }
});

// ==================== PEDAGÓGIAI AI ADVISOR ENDPOINT-OK ====================

// Helper a chatbot session lekérdezéséhez
const getChatDoc = async (parentId) => {
  let chatDoc = await ParentChatHistory.findOne({ parentId });
  if (!chatDoc) {
    chatDoc = new ParentChatHistory({ parentId });
    await chatDoc.save();
  }
  return chatDoc;
};

// GET /api/parent/chat/history - Szülői beszélgetések listája
router.get('/chat/history', authenticateParent, async (req, res) => {
  try {
    const chatDoc = await getChatDoc(req.userId);
    const session = chatDoc.getCurrentSession();
    
    const sessions = chatDoc.sessions
      .map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        updatedAt: s.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      messages: session.messages,
      sessions,
      currentSessionId: chatDoc.currentSessionId
    });
  } catch (error) {
    console.error('[Parent API] Chat history error:', error);
    res.status(500).json({ message: 'Hiba a chat előzmények betöltésekor.' });
  }
});

// POST /api/parent/chat/new-session - Új beszélgetés indítása
router.post('/chat/new-session', authenticateParent, async (req, res) => {
  try {
    const chatDoc = await getChatDoc(req.userId);
    chatDoc.currentSessionId = null; // Megszünteti az aktív kijelölést, így a getCurrentSession újat hoz létre
    await chatDoc.save();
    res.json({ message: 'Új beszélgetés indítva.' });
  } catch (error) {
    console.error('[Parent API] New chat session error:', error);
    res.status(500).json({ message: 'Hiba az új beszélgetés indításakor.' });
  }
});

// POST /api/parent/chat/load-session - Egy beszélgetés betöltése
router.post('/chat/load-session', authenticateParent, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'A beszélgetés azonosító megadása kötelező.' });

    const chatDoc = await getChatDoc(req.userId);
    const session = chatDoc.sessions.find(s => s.sessionId === sessionId);
    if (!session) return res.status(404).json({ message: 'A beszélgetés nem található.' });

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
      messages: session.messages,
      sessions
    });
  } catch (error) {
    console.error('[Parent API] Load chat session error:', error);
    res.status(500).json({ message: 'Hiba a beszélgetés betöltésekor.' });
  }
});

// DELETE /api/parent/chat/session/:sessionId - Beszélgetés törlése
router.delete('/chat/session/:sessionId', authenticateParent, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const chatDoc = await getChatDoc(req.userId);

    const sessionIndex = chatDoc.sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) return res.status(404).json({ message: 'A beszélgetés nem található.' });

    chatDoc.sessions.splice(sessionIndex, 1);
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

    res.json({ message: 'Beszélgetés törölve.', sessions });
  } catch (error) {
    console.error('[Parent API] Delete chat session error:', error);
    res.status(500).json({ message: 'Hiba a beszélgetés törlése során.' });
  }
});

// PUT /api/parent/chat/session/:sessionId - Beszélgetés átnevezése
router.put('/chat/session/:sessionId', authenticateParent, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'A beszélgetés címe nem lehet üres.' });
    }

    const chatDoc = await getChatDoc(req.userId);
    const session = chatDoc.sessions.find(s => s.sessionId === sessionId);
    if (!session) return res.status(404).json({ message: 'A beszélgetés nem található.' });

    session.title = title.substring(0, 100);
    await chatDoc.save();

    const sessions = chatDoc.sessions
      .map(s => ({
        sessionId: s.sessionId,
        title: s.title,
        updatedAt: s.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ message: 'Beszélgetés sikeresen átnevezve.', sessions });
  } catch (error) {
    console.error('[Parent API] Rename chat session error:', error);
    res.status(500).json({ message: 'Hiba a beszélgetés átnevezése során.' });
  }
});

// POST /api/parent/chat/send - AI tanár üzenet küldése (streaming, modelOverride támogatással)
router.post('/chat/send', authenticateParent, async (req, res) => {
  try {
    const { message, childId, stream, modelOverride } = req.body;
    if (!message) return res.status(400).json({ message: 'Az üzenet megadása kötelező.' });
    if (!childId) return res.status(400).json({ message: 'A gyermek kiválasztása kötelező a kontextushoz.' });

    const parent = req.parentUser;
    if (!parent.children.includes(childId)) {
      return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
    }

    const child = await User.findById(childId);
    if (!child) return res.status(404).json({ message: 'A gyermek nem található.' });

    const [progress, diagnostics] = await Promise.all([
      StudentProgress.findOne({ studentId: childId }),
      DiagnosticResult.find({ studentId: childId, status: 'analyzed' })
    ]);

    // Összegyűjtjük a tantárgyi haladást
    const subjectProgress = progress?.subjectProgress || [];
    let progressContext = '';
    subjectProgress.forEach(sp => {
      const completed = (sp.checkpoints || []).filter(c => c.status === 'completed').length;
      const total = (sp.checkpoints || []).length;
      const avgScore = completed > 0
        ? Math.round((sp.checkpoints || []).filter(c => c.status === 'completed').reduce((s, c) => s + (c.score || 0), 0) / completed)
        : 0;
      if (total > 0) {
        progressContext += `\n- ${sp.subject}: ${completed}/${total} fejezet teljesítve, átlag ${avgScore}%, szint ${sp.currentLevel || 1}, ${sp.subjectXP || 0} XP`;
      }
    });

    // Szintfelmérő eredmények és AI elemzések
    let diagnosticContext = '';
    diagnostics.forEach(d => {
      const strengths = d.aiAnalysis?.strengths?.map(s => s.category).join(', ') || '';
      const weaknesses = d.aiAnalysis?.weaknesses?.map(w => w.category).join(', ') || '';
      diagnosticContext += `\n- ${d.subject} szintfelmérő: ${d.scorePercentage.toFixed(0)}%`;
      if (strengths) diagnosticContext += `, erősségek: ${strengths}`;
      if (weaknesses) diagnosticContext += `, fejlesztendő: ${weaknesses}`;
    });

    const systemPrompt = `Te a Feladify rendszer AI tanára vagy. Kettős szerepet töltesz be:

**1. A gyermek személyes oktatója**: Amikor a szülő egy tantárgyhoz vagy feladathoz kér segítséget, úgy magyarázol, hogy a szülő ezt közvetlenül átadhassa a gyermeknek – életkori szinthez igazított magyarázatokkal, otthon elvégezhető gyakorlatokkal, szemléletes példákkal.

**2. A szülő tanulási partnerje**: Segítesz a szülőnek megérteni és nyomon követni, hogyan halad a gyermek a Feladify rendszerben – az XP pontokat, a teljesített fejezeteket, a szintfelmérő eredményeket és a fejlesztendő területeket.

**Elveid:**
- Mindig a gyermek tényleges haladási adataihoz igazítsd a válaszokat – hivatkozz konkrét eredményekre, ha releváns.
- Adj megvalósítható, játékos ötleteket otthoni gyakorláshoz (mindennapi helyzetek, konyhai matek, közös olvasás, stb.).
- Emeld ki az erősségeket, a fejlesztendő területeket lehetőségként mutasd be.
- Pozitív, bátorító, türelmes hangnemben kommunikálj.
- Formázd válaszaidat áttekinthetően: bekezdések, felsorolások, **félkövér** kiemelések.
- Válaszolj kizárólag magyarul.

**A tanuló:**
- Név: ${child.name}
- Osztály: ${child.className || 'nincs megadva'}
${progress ? `- Összes XP: ${progress.totalXP}, tanulási sorozat: ${progress.getEffectiveStreak()} nap` : ''}
${progressContext ? `\n**Egyéni gyakorlás haladása:**${progressContext}` : ''}
${diagnosticContext ? `\n**Szintfelmérő eredmények:**${diagnosticContext}` : ''}`;

    const chatDoc = await getChatDoc(parent._id);
    chatDoc.addMessage('user', message);
    await chatDoc.save();

    const history = chatDoc.getRecentMessages(12);
    const messagesForAI = history.map(msg => ({ role: msg.role, content: msg.content }));

    const streamMode = stream === true || req.body.stream || req.query.stream === 'true';

    if (streamMode) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      let fullResponse = '';
      for await (const chunk of groqService.generateResponseStream(systemPrompt, messagesForAI, { temperature: 0.75, max_tokens: 2048 }, true, modelOverride)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      if (fullResponse.trim() && !fullResponse.startsWith('Az AI szolgáltatás')) {
        chatDoc.addMessage('assistant', fullResponse);
        await chatDoc.save();
      }

      res.write(`data: ${JSON.stringify({ done: true, sessionId: chatDoc.currentSessionId })}\n\n`);
      res.end();
      return;
    }

    const aiResponse = await groqService.generateResponse(systemPrompt, messagesForAI, { temperature: 0.75, max_tokens: 2048 }, true, modelOverride);
    chatDoc.addMessage('assistant', aiResponse);
    await chatDoc.save();

    res.json({ message: aiResponse, sessionId: chatDoc.currentSessionId });
  } catch (error) {
    console.error('[Parent API] Chat send error:', error);
    if (res.headersSent) return;
    res.status(500).json({ message: 'Hiba az üzenet feldolgozása során.' });
  }
});

module.exports = router;
