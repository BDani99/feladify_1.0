const express = require('express');
const fs = require('fs');
const path = require('path');
const authenticateTeacher = require('../middleware/authenticateTeacher');
const User = require('../models/User');

const router = express.Router();

const COUNTER_FILE = path.join(__dirname, '../data/monthlyCost.json');

// GET /api/admin/cost-stats – havi AI cost tracker adatok, user nevekkel
router.get('/cost-stats', authenticateTeacher, async (req, res) => {
  try {
    if (!fs.existsSync(COUNTER_FILE)) {
      return res.json({
        month: null,
        callCount: 0,
        totalCostUSD: 0,
        byModel: {},
        byChain: {},
        byUser: {},
      });
    }

    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));

    // User nevek hozzáadása a byUser bejegyzésekhez
    const byUser = data.byUser || {};
    const userIds = Object.keys(byUser);

    if (userIds.length > 0) {
      try {
        const users = await User.find({ _id: { $in: userIds } }).select('_id name email role').lean();
        const userMap = {};
        users.forEach(u => {
          userMap[String(u._id)] = {
            name: u.name || u.email || String(u._id),
            email: u.email,
            role: u.role,
          };
        });

        const byUserWithNames = {};
        for (const [uid, stats] of Object.entries(byUser)) {
          byUserWithNames[uid] = {
            ...stats,
            ...(userMap[uid] || { name: uid, email: null, role: null }),
          };
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

module.exports = router;
