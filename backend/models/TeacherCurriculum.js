const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  recommendedHours: { type: Number, default: 0 },
  learningOutcomes: { type: String, default: '' },
  developmentalTasks: { type: String, default: '' },
  concepts: { type: String, default: '' },
  suggestedActivities: { type: String, default: '' }
});

const teacherCurriculumSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true }, // Normalized lowercase subject name
  grade: { type: String, required: true }, // e.g. "5", "6", "7", "8"
  topics: [topicSchema],
  createdAt: { type: Date, default: Date.now }
});

// Ensure a teacher only has one custom curriculum per subject and individual grade
teacherCurriculumSchema.index({ teacherId: 1, subject: 1, grade: 1 }, { unique: true });

module.exports = mongoose.model('TeacherCurriculum', teacherCurriculumSchema);
