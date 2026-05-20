const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Assignment = require('./backend/models/Assignment');
require('dotenv').config({ path: './backend/.env' });

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const student = await User.findOne({ name: 'tesztdiák' }).populate('assignments.assignmentId');
    if (!student) {
      console.log('Nincs tesztdiák');
    } else {
      console.log('Tesztdiák megtalálva, ID:', student._id);
      console.log('Assignments tömb hossza:', student.assignments?.length);
      
      const completed = student.assignments
          .filter(a => !a.isDraft)
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, 5);
      
      console.log('Completed db:', completed.length);
      if (completed.length > 0) {
          console.log('Első assignmentId (populated?):', !!completed[0].assignmentId);
          console.log('Első assignment:', JSON.stringify(completed[0], null, 2));
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
