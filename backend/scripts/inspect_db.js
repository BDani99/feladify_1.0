require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DiagResult = mongoose.model('DiagnosticResult', new mongoose.Schema({}, { strict: false }));
    const StudentChat = mongoose.model('StudentChatHistory', new mongoose.Schema({}, { strict: false }));
    const ParentChat = mongoose.model('ParentChatHistory', new mongoose.Schema({}, { strict: false }));
    const TeacherChat = mongoose.model('TeacherChatHistory', new mongoose.Schema({}, { strict: false }));

    const allUsers = await User.find({}).lean();
    const diags = await DiagResult.find({}).lean();
    const studentChats = await StudentChat.find({}).lean();
    const parentChats = await ParentChat.find({}).lean();
    const teacherChats = await TeacherChat.find({}).lean();

    const activeUserIds = new Set();
    diags.forEach(d => { if (d.studentId) activeUserIds.add(d.studentId.toString()); });
    studentChats.forEach(c => { if (c.studentId) activeUserIds.add(c.studentId.toString()); });
    parentChats.forEach(c => { if (c.parentId) activeUserIds.add(c.parentId.toString()); });
    teacherChats.forEach(c => { if (c.teacherId) activeUserIds.add(c.teacherId.toString()); });

    console.log(`Total users in DB: ${allUsers.length}`);
    console.log(`Active users in DB (based on AI/chat/diagnostic activity): ${activeUserIds.size}`);
    
    // Print active users
    for (const id of activeUserIds) {
      const user = allUsers.find(u => u._id.toString() === id);
      if (user) {
        console.log(`- Active User: ${user.name} (${user.email}) - Role: ${user.role}`);
      } else {
        console.log(`- Active User ID (not found in users collection): ${id}`);
      }
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
