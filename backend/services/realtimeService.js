const Class = require('../models/Class');

class RealtimeService {
  constructor() {
    this.clients = new Map(); // userId -> { res, classIds: Set }
  }

  addClient(userId, res) {
    console.log(`[RealtimeService] User connected: ${userId}`);
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send a connection confirmation message
    res.write('data: {"connected": true}\n\n');

    const client = { res, classIds: new Set() };
    this.clients.set(String(userId), client);

    // Populate client's classes if they are a teacher
    this.updateClientClasses(userId).catch(err => {
      console.error('[RealtimeService] Error loading client classes:', err.message);
    });

    res.on('close', () => {
      console.log(`[RealtimeService] User disconnected: ${userId}`);
      this.clients.delete(String(userId));
    });
  }

  async updateClientClasses(userId) {
    const client = this.clients.get(String(userId));
    if (!client) return;

    // Find all classes managed by this teacher
    const classes = await Class.find({ teacherIds: userId });
    classes.forEach(c => {
      client.classIds.add(String(c._id));
    });
  }

  sendToUser(userId, event, data) {
    const client = this.clients.get(String(userId));
    if (client) {
      try {
        console.log(`[RealtimeService] Sending event "${event}" to user ${userId}`);
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch (err) {
        console.error(`[RealtimeService] Error sending to user ${userId}:`, err.message);
        this.clients.delete(String(userId));
      }
    }
    return false;
  }

  sendToUsers(userIds, event, data) {
    userIds.forEach(userId => {
      this.sendToUser(userId, event, data);
    });
  }

  async notifyClassTeachers(classId, event, data) {
    try {
      const classDoc = await Class.findById(classId);
      if (!classDoc) return;

      console.log(`[RealtimeService] Notifying teachers of class ${classDoc.name} about "${event}"`);
      this.sendToUsers(classDoc.teacherIds, event, data);
    } catch (err) {
      console.error('[RealtimeService] Error notifying teachers:', err.message);
    }
  }
}

module.exports = new RealtimeService();
