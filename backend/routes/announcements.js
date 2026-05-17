const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const Class = require('../models/Class');
const User = require('../models/User');
const Notification = require('../models/Notification');
const authenticateUser = require('../middleware/authenticateUser');

// Helper a valós idejű értesítések küldéséhez
async function notify(userId, type, title, message, data = {}) {
  try {
    await Notification.create({ userId, type, title, message, data });
  } catch (e) {
    console.error('[Announcement Notification] Hiba:', e.message);
  }
}

// Minden kérést hitelesítünk az authenticateUser middleware-rel
router.use(authenticateUser);

// 1. Közlemények lekérése (Diák/Tanár szerepkör-specifikusan)
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Felhasználó nem található.' });

    if (user.role === 'student') {
      // Megkeressük az osztályokat, amikbe a diák jár
      const studentClasses = await Class.find({ studentIds: req.userId }).select('_id');
      const classIds = studentClasses.map(c => c._id);

      // Lekérjük az ezekhez az osztályokhoz tartozó közleményeket
      const announcements = await Announcement.find({ classId: { $in: classIds } })
        .populate('teacherId', 'name')
        .populate('classId', 'name')
        .sort({ createdAt: -1 });

      res.json({ announcements, classes: [] });
    } else if (user.role === 'teacher') {
      // Tanárként lekérjük a saját közleményeinket
      const announcements = await Announcement.find({ teacherId: req.userId })
        .populate('classId', 'name')
        .sort({ createdAt: -1 });

      // Lekérjük a tanárhoz tartozó osztályokat is, hogy tudjon választani közlemény írásakor
      const classes = await Class.find({ teacherIds: req.userId }).select('_id name');

      res.json({ announcements, classes });
    } else {
      res.status(403).json({ message: 'Érvénytelen szerepkör.' });
    }
  } catch (error) {
    console.error('[GET Announcements Error]', error);
    res.status(500).json({ message: 'Hiba a közlemények lekérésekor.' });
  }
});

// 2. Új közlemény közzététele (Csak tanárnak)
router.post('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'teacher') {
      return res.status(403).json({ message: 'Csak tanárok tehetnek ki közleményt.' });
    }

    const { title, content, classId } = req.body;
    if (!title || !content || !classId) {
      return res.status(400).json({ message: 'Cím, tartalom és osztály megadása kötelező.' });
    }

    // Ellenőrizzük, hogy a tanár tanít-e ebben az osztályban
    const targetClass = await Class.findOne({ _id: classId, teacherIds: req.userId });
    if (!targetClass) {
      return res.status(403).json({ message: 'Nincs jogosultsága ehhez az osztályhoz.' });
    }

    const announcement = new Announcement({
      teacherId: req.userId,
      classId,
      title: title.trim(),
      content: content.trim()
    });

    await announcement.save();

    // Értesítés küldése az osztály összes diákjának
    const studentIds = targetClass.studentIds || [];
    const teacherName = user.name || 'Egy tanár';
    
    // Fire-and-forget értesítés küldés minden diáknak
    Promise.all(
      studentIds.map(studentId => 
        notify(
          studentId, 
          'announcement', 
          'Új faliújság bejegyzés', 
          `${teacherName} új bejegyzést írt: "${title}"`, 
          { announcementId: announcement._id }
        )
      )
    ).catch(err => console.error('[Announcement Notification Alert Error]', err));

    const populatedAnnouncement = await Announcement.findById(announcement._id).populate('classId', 'name');

    res.status(201).json({
      success: true,
      message: 'Közlemény sikeresen közzétéve.',
      announcement: populatedAnnouncement
    });
  } catch (error) {
    console.error('[POST Announcement Error]', error);
    res.status(500).json({ message: 'Hiba a közlemény közzétételekor.' });
  }
});

// 3. Közlemény törlése (Csak saját közleményt törölhet a tanár)
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.role !== 'teacher') {
      return res.status(403).json({ message: 'Csak tanárok törölhetnek közleményt.' });
    }

    const announcement = await Announcement.findOne({ _id: req.params.id, teacherId: req.userId });
    if (!announcement) {
      return res.status(404).json({ message: 'Közlemény nem található vagy nincs hozzá jogosultsága.' });
    }

    await Announcement.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Közlemény sikeresen törölve.' });
  } catch (error) {
    console.error('[DELETE Announcement Error]', error);
    res.status(500).json({ message: 'Hiba a közlemény törlésekor.' });
  }
});

module.exports = router;
