require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const assignmentRoutes = require('./routes/assignments');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/student');
const parentRoutes = require('./routes/parent');
const notificationRoutes = require('./routes/notifications');
const documentRoutes = require('./routes/documents');
const realtimeRoutes = require('./routes/realtime');
const announcementRoutes = require('./routes/announcements');
const adminRoutes = require('./routes/admin');
const curriculumRoutes = require('./routes/curriculum');
const { startCleanupJob } = require('./jobs/cleanupAnnouncements');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Vercel serverless-kompatibilis MongoDB kapcsolat
let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI)
      .then(() => { 
        console.log('Connected to MongoDB'); 
      })
      .catch(err => { connectionPromise = null; throw err; });
  }
  await connectionPromise;
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    res.status(500).json({ message: 'Database connection error' });
  }
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feladify API</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0}
    .card{background:rgba(30,41,59,0.8);border:1px solid rgba(99,102,246,0.2);border-radius:20px;padding:48px 56px;max-width:480px;width:90%;text-align:center;backdrop-filter:blur(10px)}
    .logo{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff;margin:0 auto 24px}
    h1{font-size:28px;font-weight:800;margin-bottom:8px}
    p{color:#64748b;font-size:15px;line-height:1.6;margin-bottom:24px}
    .status{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);font-size:13px;color:#10b981;font-weight:600;margin-bottom:28px}
    .dot{width:8px;height:8px;border-radius:50%;background:#10b981;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    a{padding:8px 20px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;transition:all .2s}
    .btn-admin{background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)}
    .btn-admin:hover{background:rgba(59,130,246,0.25)}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">F</div>
    <h1>Feladify API</h1>
    <p>Oktatási platform backend API szervere.<br>A frontend alkalmazás elérhető a megfelelő URL-en.</p>
    <div class="status"><span class="dot"></span>Szerver üzemel</div>
    <div class="links">
      <a href="/admin" class="btn-admin">🛡️ Admin Panel</a>
    </div>
  </div>
</body>
</html>`);
});

// Útvonalak hozzáadása
app.use('/api', classRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/curriculum', curriculumRoutes);

// Admin panel — static files at /admin
const adminPath = path.join(__dirname, 'public/admin');
app.use('/admin', express.static(adminPath));
app.get('/admin', (req, res) => res.sendFile(path.join(adminPath, 'index.html')));
app.get('/admin/*', (req, res) => res.sendFile(path.join(adminPath, 'index.html')));

startCleanupJob();

const { sendError } = require('./utils/errorResponse');

app.use((req, res) => {
  sendError(res, 404, 'A kért végpont nem található.', 'NOT_FOUND');
});

app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Váratlan szerverhiba történt.';
  sendError(res, status, message, err.code || 'SERVER_ERROR');
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
