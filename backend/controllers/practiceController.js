const StudentProgress = require('../../models/StudentProgress');

// GET /api/student/practice?subject=Matematika
exports.getPracticePath = async (req, res) => {
  try {
    const userId = req.user.id; // Feltételezve, hogy van auth middleware
    const { subject } = req.query;

    if (!subject) {
      return res.status(400).json({ message: 'Tantárgy megadása kötelező!' });
    }

    // Keresünk progress rekordot, ha nincs, létrehozunk egy újat
    let progress = await StudentProgress.findOne({ studentId: userId });
    if (!progress) {
      progress = new StudentProgress({ studentId: userId, subjectProgress: [] });
    }

    // Megkeressük az adott tantárgyat
    let subjectData = progress.subjectProgress.find(sp => sp.subject === subject);
    
    // Ha ebből a tantárgyból még sose csinált semmit
    if (!subjectData) {
      subjectData = {
        subject: subject,
        status: 'requires_diagnostic',
        currentLevel: 1,
        checkpoints: []
      };
      progress.subjectProgress.push(subjectData);
      await progress.save();
      
      // Frissítjük a referenciát mentés után
      subjectData = progress.subjectProgress.find(sp => sp.subject === subject);
    }

    res.json(subjectData);
  } catch (error) {
    console.error('[PracticeController] getPracticePath hiba:', error);
    res.status(500).json({ message: `Szerverhiba: ${error.message}` });
  }
};

// POST /api/student/practice/submit
exports.submitPracticeCheckpoint = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, checkpointId, score } = req.body;

    const progress = await StudentProgress.findOne({ studentId: userId });
    if (!progress) {
      return res.status(404).json({ message: 'Diák adatai nem találhatók.' });
    }

    const subjectData = progress.subjectProgress.find(sp => sp.subject === subject);
    if (!subjectData) {
      return res.status(404).json({ message: 'Ebből a tantárgyból még nincs megkezdett folyamat.' });
    }

    const checkpoint = subjectData.checkpoints.find(c => c.checkpointId === checkpointId);
    if (!checkpoint) {
      return res.status(404).json({ message: 'A megadott küldetés (checkpoint) nem található.' });
    }

    // Frissítjük a checkpoint eredményét
    checkpoint.score = score;
    checkpoint.attempts += 1;
    
    // Ha elérte a küszöböt (pl. 70%), akkor teljesített
    if (score >= 70) {
      checkpoint.status = 'completed';
      checkpoint.completedAt = new Date();
      progress.addXP(50); // Adunk 50 XP-t
    }

    // Megnézzük, van-e következő, amit fel kell oldani
    const currentIndex = subjectData.checkpoints.findIndex(c => c.checkpointId === checkpointId);
    let isLevelComplete = true;

    if (score >= 70 && currentIndex < subjectData.checkpoints.length - 1) {
      // Feloldjuk a következőt
      subjectData.checkpoints[currentIndex + 1].status = 'unlocked';
      isLevelComplete = false;
    } else if (currentIndex < subjectData.checkpoints.length - 1) {
      isLevelComplete = false;
    }

    // Ha az összeset teljesítette
    if (isLevelComplete && checkpoint.status === 'completed') {
      subjectData.status = 'level_complete';
      progress.addXP(100); // Bónusz XP szintlépésért
    }

    // Kitűzők csekkolása
    const newBadges = progress.checkBadges();

    await progress.save();

    res.json({
      success: true,
      newBadges: newBadges,
      subjectProgress: subjectData
    });

  } catch (error) {
    console.error('[PracticeController] submitPracticeCheckpoint hiba:', error);
    res.status(500).json({ message: `Szerverhiba: ${error.message}` });
  }
};