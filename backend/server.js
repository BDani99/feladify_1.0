require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const assignmentRoutes = require('./routes/assignments');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/student');
const notificationRoutes = require('./routes/notifications');

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
      .then(() => { console.log('Connected to MongoDB'); })
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

// Egyszerű üdvözlő endpoint
app.get('/', (req, res) => {
  res.send('Welcome to the ChatGPT Assignment App');
});

// Útvonalak hozzáadása
app.use('/api', classRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/notifications', notificationRoutes);

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
