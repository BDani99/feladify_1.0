const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { 
    type: String, 
    enum: ['user', 'assistant', 'system'], 
    required: true 
  },
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

const studentChatHistorySchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  sessions: [chatSessionSchema],
  currentSessionId: { type: String },
  lastActive: { type: Date, default: Date.now }
});

// Index for faster queries
studentChatHistorySchema.index({ studentId: 1, 'sessions.sessionId': 1 });

// Pre-save middleware to update timestamps
studentChatHistorySchema.pre('save', function(next) {
  this.lastActive = Date.now();
  
  // Update the current session's updatedAt
  if (this.currentSessionId) {
    const session = this.sessions.id(this.currentSessionId);
    if (session) {
      session.updatedAt = Date.now();
    }
  }
  
  next();
});

// Method to get or create current session
studentChatHistorySchema.methods.getCurrentSession = function() {
  if (!this.currentSessionId || !this.sessions.id(this.currentSessionId)) {
    // Create new session
    const newSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'Új beszélgetés',
      messages: []
    };
    this.sessions.push(newSession);
    this.currentSessionId = newSession.sessionId;
  }
  
  // Return the session object directly from the array
  const session = this.sessions.find(s => s.sessionId === this.currentSessionId);
  return session;
};

// Method to add message to current session
studentChatHistorySchema.methods.addMessage = function(role, content) {
  const session = this.getCurrentSession();
  
  if (!session) {
    // Fallback: create a new session if getCurrentSession failed
    const newSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'Új beszélgetés',
      messages: []
    };
    this.sessions.push(newSession);
    this.currentSessionId = newSession.sessionId;
    return newSession;
  }
  
  session.messages.push({
    role,
    content,
    timestamp: new Date()
  });
  
  // Auto-generate title from first user message
  if (session.messages.length === 1 && role === 'user') {
    session.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }
  
  return session;
};

// Method to get recent messages for context
studentChatHistorySchema.methods.getRecentMessages = function(limit = 50) {
  const session = this.getCurrentSession();
  if (!session) return [];
  
  // Return the most recent messages
  return session.messages.slice(-limit);
};

// Method to get all sessions for a student
studentChatHistorySchema.statics.getStudentSessions = async function(studentId) {
  const studentChat = await this.findOne({ studentId });
  if (!studentChat) return [];
  
  return studentChat.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
};

// Method to clear old sessions (keep only last N)
studentChatHistorySchema.methods.cleanupOldSessions = async function(keepCount = 10) {
  if (this.sessions.length > keepCount) {
    // Sort by updatedAt descending and keep only the most recent ones
    this.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    this.sessions = this.sessions.slice(0, keepCount);
  }
};

module.exports = mongoose.model('StudentChatHistory', studentChatHistorySchema);