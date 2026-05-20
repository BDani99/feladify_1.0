const mongoose = require('mongoose');

const assignmentAnswerSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  answers: [
    {
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
      studentAnswer: { type: mongoose.Schema.Types.Mixed },
      score: { type: Number, default: 0 },
      confidence: { type: Number, default: null },
      aiFeedback: { type: String, default: '' },
      flagged: { type: Boolean, default: false },
      flagResponse: { type: String, default: '' },
      flagRejected: { type: Boolean, default: false }
    }
  ],
  achievedPoints: { type: Number, default: 0 },
  suggestedGrade: { type: Number, default: null },
  grade: { type: Number, default: null },
  completedAt: { type: Date, default: Date.now },
  isDraft: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student', 'parent', 'admin'], required: true },
  subjects: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        if (this.role === 'teacher') return v && v.length > 0;
        return true;
      },
      message: 'Legalább egy tantárgy megadása kötelező a tanároknak.'
    }
  },
  className: { 
    type: String, 
    required: function() { return this.role === 'student'; }, 
    message: 'Az osztály megadása kötelező a diákoknak.' 
  },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  parentSettings: {
    notifyLowGrade: { type: Boolean, default: false },
    lowGradeThreshold: { type: Number, default: 3 },
    notifyUpcomingDeadline: { type: Boolean, default: false },
    deadlineThresholdHours: { type: Number, default: 24 }
  },
  assignments: [assignmentAnswerSchema], // Kitöltött dolgozatok tárolása
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);