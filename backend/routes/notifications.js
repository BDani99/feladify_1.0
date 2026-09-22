const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authenticateUser');
const Notification = require('../models/Notification');

// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });
    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ message: 'Hiba az értesítések lekérésekor' });
  }
});

// PUT /api/notifications/read-all  — MUST be before /:id route
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.json({ message: 'Összes értesítés olvasottá jelölve' });
  } catch {
    res.status(500).json({ message: 'Hiba' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: req.userId },
      { read: true }
    );
    res.json({ message: 'OK' });
  } catch {
    res.status(500).json({ message: 'Hiba' });
  }
});

// DELETE /api/notifications/all
router.delete('/all', authMiddleware, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.userId });
    res.json({ message: 'Összes értesítés törölve' });
  } catch {
    res.status(500).json({ message: 'Hiba' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Értesítés törölve' });
  } catch {
    res.status(500).json({ message: 'Hiba' });
  }
});

module.exports = router;
