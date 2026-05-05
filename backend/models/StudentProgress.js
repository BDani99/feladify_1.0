const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  subject: { type: String, required: true },
  topic: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['locked', 'unlocked', 'completed'], 
    default: 'locked' 
  },
  score: { type: Number, default: 0, min: 0, max: 100 },
  isExtraPractice: { type: Boolean, default: false },
  completedAt: { type: Date },
  attempts: { type: Number, default: 0 }
});

const badgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String },
  earnedAt: { type: Date, default: Date.now }
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
  roadmap: [nodeSchema],
  dailyGoal: { type: Number, default: 100 },
  weeklyGoal: { type: Number, default: 700 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to update the updatedAt field
studentProgressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check and update streak
studentProgressSchema.methods.updateStreak = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (this.lastActiveDate) {
    const lastActive = new Date(this.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Same day, no change
      return this.streak;
    } else if (diffDays === 1) {
      // Consecutive day, increment streak
      this.streak += 1;
    } else {
      // Streak broken, reset to 1
      this.streak = 1;
    }
  } else {
    // First time, start streak
    this.streak = 1;
  }
  
  this.lastActiveDate = new Date();
  return this.streak;
};

// Method to add XP
studentProgressSchema.methods.addXP = function(amount) {
  this.totalXP += amount;
  this.updateStreak();
  return this.totalXP;
};

// Method to check and award badges
studentProgressSchema.methods.checkBadges = function() {
  const newBadges = [];
  
  // Streak badges
  if (this.streak >= 7 && !this.badges.find(b => b.id === 'streak_7')) {
    newBadges.push({
      id: 'streak_7',
      name: 'Hétnapos Láncreakció',
      description: '7 egymást követő napon át aktív voltál!',
      icon: '🔥'
    });
  }
  
  if (this.streak >= 30 && !this.badges.find(b => b.id === 'streak_30')) {
    newBadges.push({
      id: 'streak_30',
      name: 'Hónapos Mester',
      description: '30 egymást követő napon át aktív voltál!',
      icon: '🏆'
    });
  }
  
  // XP badges
  if (this.totalXP >= 1000 && !this.badges.find(b => b.id === 'xp_1000')) {
    newBadges.push({
      id: 'xp_1000',
      name: 'Ezer XP Klub',
      description: 'Elérted az 1000 XP-t!',
      icon: '⭐'
    });
  }
  
  if (this.totalXP >= 5000 && !this.badges.find(b => b.id === 'xp_5000')) {
    newBadges.push({
      id: 'xp_5000',
      name: 'XP Mester',
      description: 'Elérted az 5000 XP-t!',
      icon: '🌟'
    });
  }
  
  // Perfect score badge
  const perfectScores = this.roadmap.filter(n => n.score === 100).length;
  if (perfectScores >= 5 && !this.badges.find(b => b.id === 'perfect_5')) {
    newBadges.push({
      id: 'perfect_5',
      name: 'Tökéletes Ötös',
      description: '5 dolgozatot oldottál meg 100%-os eredményekkel!',
      icon: '💯'
    });
  }
  
  // Add new badges to the collection
  this.badges.push(...newBadges);
  
  return newBadges;
};

module.exports = mongoose.model('StudentProgress', studentProgressSchema);