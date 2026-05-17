const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProgress = require('../models/StudentProgress');
const ParentChatHistory = require('../models/ParentChatHistory');
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const DiagnosticResult = require('../models/DiagnosticResult');
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

// POST /api/parent/chat/send - AI Advisor üzenet küldése (Socrates-i coaching, streaming opció)
router.post('/chat/send', authenticateParent, async (req, res) => {
  try {
    const { message, childId, stream } = req.body;
    if (!message) return res.status(400).json({ message: 'Az üzenet megadása kötelező.' });
    if (!childId) return res.status(400).json({ message: 'A gyermek kiválasztása kötelező a kontextushoz.' });

    const parent = req.parentUser;
    if (!parent.children.includes(childId)) {
      return res.status(403).json({ message: 'Nincs jogosultsága ehhez a gyermekhez.' });
    }

    const child = await User.findById(childId);
    if (!child) return res.status(404).json({ message: 'A gyermek nem található.' });

    // Megkeressük a gyermek fejlődési statisztikáit és gyengeségeit
    const progress = await StudentProgress.findOne({ studentId: childId });
    const diagnostics = await DiagnosticResult.find({ studentId: childId, status: 'analyzed' });

    let diagnosticContext = '';
    diagnostics.forEach(d => {
      const weaknesses = d.aiAnalysis?.weaknesses?.map(w => w.category).join(', ') || 'Nincsenek kiemelt gyengeségek';
      diagnosticContext += `\n- ${d.subject}: ${d.scorePercentage.toFixed(0)}% szintfelmérő eredmény. Fejlesztendő területek: ${weaknesses}`;
    });

    // ChatGPT/Groq Pedagogical Advisor rendszer-prompt
    const systemPrompt = `Te egy rendkívül képzett, barátságos és támogató pedagógiai AI tanácsadó vagy a Feladify rendszerben.
    Feladatod, hogy segíts a szülőknek megérteni gyermekük fejlődési útvonalát, erősségeit és gyengeségeit.
    Amikor a szülő tanácsot vagy segítséget kér, a válaszaidat az alábbi elvek mentén fogalmazd meg:
    1. Alkalmazz Szókratészi kérdezéstechnikát és építő visszajelzéseket ahelyett, hogy kész válaszokat adnál.
    2. Adj gyakorlatias, könnyen érthető ötleteket játékos tanulási technikákhoz (pl. mindennapi élethelyzetekből vett példák, konyhai matek játékok, közös olvasás, angol szavak keresése a szobában).
    3. Mindig maradj türelmes, támogató, empátiás és gyermekközpontú.
    4. Használj barátságos magyar nyelvet, és formázd a szöveget könnyen olvashatóan (pl. bekezdésekkel, felsorolásokkal, fontos kifejezések félkövér kiemelésével).
    
    A tanácsadás alanya (gyermek):
    - Név: ${child.name}
    - Osztály: ${child.className}
    ${diagnosticContext ? `\nGyermek jelenlegi teljesítménye és diagnosztikai elemzése:${diagnosticContext}` : ''}
    ${progress ? `\nGyermek összegyűjtött pontszáma (XP): ${progress.totalXP} XP, Aktív széria: ${progress.getEffectiveStreak()} nap.` : ''}`;

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
      for await (const chunk of groqService.generateResponseStream(systemPrompt, messagesForAI, { temperature: 0.7, max_tokens: 2048 })) {
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

    const aiResponse = await groqService.generateResponse(systemPrompt, messagesForAI, { temperature: 0.7, max_tokens: 2048 });
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
