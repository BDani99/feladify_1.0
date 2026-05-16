const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Nincs token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Érvénytelen token' });
  }
};

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

module.exports = router;
