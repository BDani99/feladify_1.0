require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const assignmentRoutes = require('./routes/assignments');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/student');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Vercel serverless-kompatibilis MongoDB kapcsolat (cachelve, hogy ne nyisson új kapcsolatot minden requestnél)
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
  console.log('Connected to MongoDB');
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

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
