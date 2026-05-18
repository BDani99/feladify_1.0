const mongoose = require('mongoose');

const goalItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['assignment_avg', 'practice_xp', 'practice_streak'],
    required: true
  },
  subject: { type: String, required: true },
  title: { type: String, required: true, maxlength: 150 },
  targetPercent: { type: Number },
  periodDays: { type: Number },
  targetXP: { type: Number },
  startTotalXP: { type: Number, default: 0 },
  startSubjectXP: { type: Number, default: 0 },
  targetStreak: { type: Number },
  deadline: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const parentGoalSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  goals: { type: [goalItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('ParentGoal', parentGoalSchema);
