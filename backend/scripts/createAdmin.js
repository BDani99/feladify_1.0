require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const crypto = require('crypto');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'feladifyadmin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'feladifyadmin@feladify.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

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
    if (!process.env.ADMIN_PASSWORD) {
      console.log('  Jelszó (generált, jegyezd fel most, nem lesz újra kiírva):', ADMIN_PASSWORD);
    } else {
      console.log('  Jelszó: az ADMIN_PASSWORD környezeti változóból beállítva.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Hiba az admin létrehozásakor:', err.message);
    process.exit(1);
  }
}

createAdmin();
