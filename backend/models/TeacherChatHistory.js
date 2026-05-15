const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const chatSessionSchema = new mongoose.Schema({
  sessionId: { type: String, default: () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` },
  title: { type: String, default: 'Új beszélgetés' },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const teacherChatHistorySchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessions: [chatSessionSchema],
  currentSessionId: { type: String },
  lastActive: { type: Date, default: Date.now }
});

teacherChatHistorySchema.index({ teacherId: 1, 'sessions.sessionId': 1 });

teacherChatHistorySchema.pre('save', function(next) {
  this.lastActive = Date.now();
  next();
});

teacherChatHistorySchema.methods.getCurrentSession = function() {
  let session = null;
  if (this.currentSessionId) {
    session = this.sessions.find(s => s.sessionId === this.currentSessionId);
  }
  if (!session) {
    const newSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'Új beszélgetés',
      messages: []
    };
    this.sessions.push(newSession);
    session = this.sessions[this.sessions.length - 1];
    this.currentSessionId = session.sessionId;
  }
  return session;
};

teacherChatHistorySchema.methods.addMessage = function(role, content) {
  const session = this.getCurrentSession();
  session.messages.push({ role, content, timestamp: new Date() });
  if (session.messages.length === 1 && role === 'user') {
    session.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }
  session.updatedAt = new Date();
  return session;
};

teacherChatHistorySchema.methods.getRecentMessages = function(limit = 20) {
  const session = this.getCurrentSession();
  if (!session) return [];
  return session.messages.slice(-limit);
};

module.exports = mongoose.model('TeacherChatHistory', teacherChatHistorySchema);
