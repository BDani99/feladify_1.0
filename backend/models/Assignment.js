const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: { type: String, default: 'short_answer' }, // mcq, true_false, short_answer, fill_blank, matching, ordering
  options: { type: [String], default: [] },
  pairs: [{ left: String, right: String }],
  items: { type: [String], default: [] },
  correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
  points: { type: Number, default: 1 },
});

const assignmentSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  difficulty: { type: String, required: true },
  questions: [questionSchema],
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  totalPoints: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
  timeLimit: { type: Number, default: null },
  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Assignment', assignmentSchema);