const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const User = require('./backend/models/User');
const Assignment = require('./backend/models/Assignment');
const Class = require('./backend/models/Class');

async function check() {
  try {
    console.log('Connecting to:', process.env.MONGO_URI ? 'Atlas (hidden)' : 'Localhost');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/feladify');
    console.log('Connected to DB');

    const user = await User.findOne({ name: 'tesztdiák' });
    if (!user) {
      console.log('Nincs tesztdiák');
    } else {
      console.log('tesztdiák megtalálva! ID:', user._id);
      console.log('Role:', user.role);
      console.log('Assignments count:', user.assignments?.length);
      console.log('XP:', user.totalXP || 'no totalXP field directly?');
      
      const pending = await Assignment.find({ studentIds: user._id });
      console.log('Pending assignments for this user:', pending.length);
    }
    
    // Check if there's any user with assignments
    const usersWithAssig = await User.find({ 'assignments.0': { $exists: true } }).select('name role assignments');
    console.log('Users with assignments:', usersWithAssig.length);
    usersWithAssig.forEach(u => {
        console.log(` - ${u.name} (${u.role}) has ${u.assignments.length} assignments`);
    });

  } catch(e) {
    console.error('DB hiba:', e);
  } finally {
    process.exit(0);
  }
}

check();
