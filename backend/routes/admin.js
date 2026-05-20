const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const authenticateAdmin = require('../middleware/authenticateAdmin');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const Announcement = require('../models/Announcement');

const router = express.Router();
const COUNTER_FILE = path.join(__dirname, '../data/monthlyCost.json');

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Felhasználónév és jelszó megadása kötelező.' });
    }

    const user = await User.findOne({ name: username, role: 'admin' });
    if (!user) {
      return res.status(401).json({ message: 'Hibás felhasználónév vagy jelszó.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Hibás felhasználónév vagy jelszó.' });
    }

    const token = jwt.sign(
      { userId: user._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Szerverhiba a bejelentkezés során.', error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role = '', search = '' } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password -assignments')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a felhasználók lekérésekor.', error: err.message });
  }
});

// POST /api/admin/users
router.post('/users', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, password, role, subjects, className } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Név, email, jelszó és szerep megadása kötelező.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Ez az email cím már foglalt.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      subjects: subjects || [],
      className: className || undefined,
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.assignments;
    res.status(201).json({ user: userObj });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a felhasználó létrehozásakor.', error: err.message });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -assignments').lean();
    if (!user) return res.status(404).json({ message: 'Felhasználó nem található.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a felhasználó lekérésekor.', error: err.message });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, role, subjects, className, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (role) update.role = role;
    if (subjects !== undefined) update.subjects = subjects;
    if (className !== undefined) update.className = className;
    if (password) update.password = await bcrypt.hash(password, 10);

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('-password -assignments')
      .lean();
    if (!user) return res.status(404).json({ message: 'Felhasználó nem található.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a felhasználó frissítésekor.', error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.userId)) {
      return res.status(400).json({ message: 'Saját admin fiókot nem törölhetsz.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Felhasználó nem található.' });
    res.json({ message: 'Felhasználó törölve.' });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a törlés során.', error: err.message });
  }
});

// GET /api/admin/cost-stats
router.get('/cost-stats', authenticateAdmin, async (req, res) => {
  try {
    if (!fs.existsSync(COUNTER_FILE)) {
      return res.json({ month: null, callCount: 0, totalCostUSD: 0, byModel: {}, byChain: {}, byUser: {} });
    }

    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    const byUser = data.byUser || {};
    const userIds = Object.keys(byUser);

    if (userIds.length > 0) {
      try {
        const users = await User.find({ _id: { $in: userIds } }).select('_id name email role').lean();
        const userMap = {};
        users.forEach(u => { userMap[String(u._id)] = { name: u.name || u.email || String(u._id), email: u.email, role: u.role }; });
        const byUserWithNames = {};
        for (const [uid, stats] of Object.entries(byUser)) {
          byUserWithNames[uid] = { ...stats, ...(userMap[uid] || { name: uid, email: null, role: null }) };
        }
        data.byUser = byUserWithNames;
      } catch (lookupErr) {
        console.warn('[Admin] User lookup hiba:', lookupErr.message);
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Hiba a cost adatok olvasásakor', error: err.message });
  }
});

// GET /api/admin/stats/overview
router.get('/stats/overview', authenticateAdmin, async (req, res) => {
  try {
    const now = new Date();
    const last7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [teacherCount, studentCount, parentCount, adminCount,
      newLast7, newLast30, assignmentCount] = await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'parent' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ createdAt: { $gte: last7 } }),
      User.countDocuments({ createdAt: { $gte: last30 } }),
      Assignment.countDocuments(),
    ]);

    let monthlyCost = 0;
    if (fs.existsSync(COUNTER_FILE)) {
      try {
        const costData = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
        monthlyCost = costData.totalCostUSD || 0;
      } catch (_) {}
    }

    const recentUsers = await User.find({ role: { $ne: 'admin' } })
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      users: { teacher: teacherCount, student: studentCount, parent: parentCount, admin: adminCount, total: teacherCount + studentCount + parentCount },
      newRegistrations: { last7, last30: newLast30 },
      assignmentCount,
      monthlyCost,
      recentUsers,
    });
  } catch (err) {
    res.status(500).json({ message: 'Hiba az összesítő adatok lekérésekor.', error: err.message });
  }
});

// GET /api/admin/stats/activity
router.get('/stats/activity', authenticateAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const registrationsByDay = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, role: { $ne: 'admin' } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    const roleDistribution = await User.aggregate([
      { $match: { role: { $ne: 'admin' } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const recentUsers = await User.find({ role: { $ne: 'admin' } })
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({ registrationsByDay, roleDistribution, recentUsers });
  } catch (err) {
    res.status(500).json({ message: 'Hiba az aktivitási adatok lekérésekor.', error: err.message });
  }
});

// GET /api/admin/stats/assignments
router.get('/stats/assignments', authenticateAdmin, async (req, res) => {
  try {
    const total = await Assignment.countDocuments();

    const bySubject = await Assignment.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const submittedCount = await User.aggregate([
      { $match: { role: 'student' } },
      { $project: { submittedCount: { $size: '$assignments' } } },
      { $group: { _id: null, total: { $sum: '$submittedCount' } } },
    ]);

    const avgGrade = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$assignments' },
      { $match: { 'assignments.grade': { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$assignments.grade' } } },
    ]);

    res.json({
      total,
      bySubject,
      submittedCount: submittedCount[0]?.total || 0,
      avgGrade: avgGrade[0]?.avg ? Math.round(avgGrade[0].avg * 10) / 10 : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a feladat statisztikák lekérésekor.', error: err.message });
  }
});

// GET /api/admin/system
router.get('/system', authenticateAdmin, async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    const maskKey = (key) => {
      if (!key) return null;
      if (key.length <= 8) return '***';
      return key.slice(0, 4) + '...' + key.slice(-4);
    };

    let costData = null;
    if (fs.existsSync(COUNTER_FILE)) {
      try { costData = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')); } catch (_) {}
    }

    res.json({
      db: { state: dbStateMap[dbState] || 'unknown', readyState: dbState },
      apiKeys: {
        GEMINI: maskKey(process.env.GEMINI_API_KEY),
        DEEPSEEK: maskKey(process.env.DEEPSEEK_API_KEY),
        QWEN: maskKey(process.env.QWEN_API_KEY),
      },
      node: process.version,
      platform: process.platform,
      uptime: Math.round(process.uptime()),
      costMonth: costData?.month || null,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a rendszerinfó lekérésekor.', error: err.message });
  }
});

// GET /api/admin/data/assignments
router.get('/data/assignments', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', subject = '' } = req.query;
    const filter = {};
    if (subject) filter.subject = subject;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const total = await Assignment.countDocuments(filter);
    const assignments = await Assignment.find(filter)
      .populate('teacherId', 'name email')
      .select('title subject difficulty createdAt dueDate completedCount totalPoints')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({ assignments, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a feladatok lekérésekor.', error: err.message });
  }
});

// DELETE /api/admin/data/assignments/:id
router.delete('/data/assignments/:id', authenticateAdmin, async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Feladat nem található.' });
    res.json({ message: 'Feladat törölve.' });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a törlés során.', error: err.message });
  }
});

// GET /api/admin/data/classes
router.get('/data/classes', authenticateAdmin, async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('teacherIds', 'name email')
      .lean();

    const result = classes.map(c => ({
      ...c,
      studentCount: c.studentIds?.length || 0,
    }));

    res.json({ classes: result });
  } catch (err) {
    res.status(500).json({ message: 'Hiba az osztályok lekérésekor.', error: err.message });
  }
});

// DELETE /api/admin/data/classes/:id
router.delete('/data/classes/:id', authenticateAdmin, async (req, res) => {
  try {
    const cls = await Class.findByIdAndDelete(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Osztály nem található.' });
    res.json({ message: 'Osztály törölve.' });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a törlés során.', error: err.message });
  }
});

// GET /api/admin/data/announcements
router.get('/data/announcements', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const total = await Announcement.countDocuments();
    const announcements = await Announcement.find()
      .populate('teacherId', 'name email')
      .populate('classId', 'name')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({ announcements, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a hirdetmények lekérésekor.', error: err.message });
  }
});

// DELETE /api/admin/data/announcements/:id
router.delete('/data/announcements/:id', authenticateAdmin, async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ message: 'Hirdetmény nem található.' });
    res.json({ message: 'Hirdetmény törölve.' });
  } catch (err) {
    res.status(500).json({ message: 'Hiba a törlés során.', error: err.message });
  }
});

module.exports = router;
