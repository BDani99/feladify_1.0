require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ADMIN_USERNAME = 'feladifyadmin';
const ADMIN_EMAIL = 'feladifyadmin@feladify.local';
const ADMIN_PASSWORD = 'EZajelszo10_';

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Csatlakozva az adatbázishoz.');

    const existing = await User.findOne({ name: ADMIN_USERNAME, role: 'admin' });
    if (existing) {
      console.log('Az admin felhasználó már létezik:', existing.email);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      name: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
    });

    console.log('Admin felhasználó sikeresen létrehozva!');
    console.log('  Felhasználónév:', ADMIN_USERNAME);
    console.log('  Jelszó:', ADMIN_PASSWORD);
    process.exit(0);
  } catch (err) {
    console.error('Hiba az admin létrehozásakor:', err.message);
    process.exit(1);
  }
}

createAdmin();
