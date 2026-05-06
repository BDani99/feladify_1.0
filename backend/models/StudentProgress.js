const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String },
  earnedAt: { type: Date, default: Date.now }
});

const subjectCheckpointSchema = new mongoose.Schema({
  checkpointId: { type: String, required: true },
  topic: { type: String, default: 'Gyakorlás' },
  difficulty: { type: Number, default: 3, min: 1, max: 5 },
  status: {
    type: String,
    enum: ['locked', 'unlocked', 'completed'],
    default: 'locked'
  },
  score: { type: Number, default: 0, min: 0, max: 100 },
  attempts: { type: Number, default: 0 },
  completedAt: { type: Date }
});

const subjectProgressSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  status: {
    type: String,
    enum: ['not_started', 'requires_diagnostic', 'in_progress', 'level_complete'],
    default: 'requires_diagnostic' // Alapból diagnosztika kell az új koncepció szerint
  },
  currentLevel: { type: Number, default: 1 },
  checkpoints: [subjectCheckpointSchema],
  lastUpdated: { type: Date, default: Date.now }
});

const studentProgressSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  totalXP: { type: Number, default: 0, min: 0 },
  streak: { type: Number, default: 0, min: 0 },
  lastActiveDate: { type: Date },
  badges: [badgeSchema],
  subjectProgress: [subjectProgressSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware az updatedAt frissítésére
studentProgressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Metódus a streak kezelésére
studentProgressSchema.methods.updateStreak = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (this.lastActiveDate) {
    const lastActive = new Date(this.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return this.streak;
    } else if (diffDays === 1) {
      this.streak += 1;
    } else {
      this.streak = 1;
    }
  } else {
    this.streak = 1;
  }
  
  this.lastActiveDate = new Date();
  return this.streak;
};

// Metódus XP hozzáadásához
studentProgressSchema.methods.addXP = function(amount) {
  this.totalXP += amount;
  this.updateStreak();
  return this.totalXP;
};

// Metódus kitűzők ellenőrzésére (kibővíthető)
studentProgressSchema.methods.checkBadges = function() {
  const newBadges = [];
  
  if (this.streak >= 3 && !this.badges.find(b => b.id === 'streak_3')) {
    newBadges.push({
      id: 'streak_3',
      name: 'Háromnapos lendület',
      description: '3 napon át folyamatosan gyakoroltál!',
      icon: '🔥'
    });
  }

  if (this.totalXP >= 500 && !this.badges.find(b => b.id === 'xp_500')) {
    newBadges.push({
      id: 'xp_500',
      name: 'Kezdő Gyakorló',
      description: 'Elérted az 500 XP-t az egyéni gyakorlás során!',
      icon: '⭐'
    });
  }
  
  if (newBadges.length > 0) {
    this.badges.push(...newBadges);
  }
  
  return newBadges;
};

module.exports = mongoose.model('StudentProgress', studentProgressSchema);