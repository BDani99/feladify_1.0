const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['new_assignment', 'assignment_submitted', 'assignment_graded', 'answer_flagged', 'announcement'],
    required: true
  },
  title:   { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 300 },
  read:    { type: Boolean, default: false },
  data:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
