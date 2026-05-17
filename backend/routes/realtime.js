const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const realtimeService = require('../services/realtimeService');

router.get('/stream', (req, res) => {
  // Support both header and query param token for browser native EventSource compatibility
  const authHeader = req.header('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Access denied: token is missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Register SSE client connection
    realtimeService.addClient(userId, res);
  } catch (error) {
    console.error('[Realtime Router] Auth error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;
