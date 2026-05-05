require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const assignmentRoutes = require('./routes/assignments');
const classRoutes = require('./routes/classes');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Csatlakozás az adatbázishoz
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Egyszerű üdvözlő endpoint
app.get('/', (req, res) => {
  res.send('Welcome to the ChatGPT Assignment App');
});

// Útvonalak hozzáadása
app.use('/api', classRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
