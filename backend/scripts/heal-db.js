const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const Folder = require('../models/Folder');
const File = require('../models/File');

const decodeUTF8String = (str) => {
  try {
    return decodeURIComponent(escape(str));
  } catch (e) {
    return str;
  }
};

const healEncodings = async () => {
  try {
    console.log('[Migration] Starting database healing...');

    // Heal Folders (querying only corrupted names containing Ã or Â)
    const folders = await Folder.find({ name: { $regex: /[ÃÂ]/ } });
    let folderCount = 0;
    for (const folder of folders) {
      const decoded = decodeUTF8String(folder.name);
      if (decoded !== folder.name) {
        console.log(`[Migration] Healing folder name: "${folder.name}" -> "${decoded}"`);
        folder.name = decoded;
        await folder.save();
        folderCount++;
      }
    }
    console.log(`[Migration] Successfully healed ${folderCount} folders.`);

    // Heal Files (querying only corrupted names containing Ã or Â)
    const files = await File.find({ name: { $regex: /[ÃÂ]/ } });
    let fileCount = 0;
    for (const file of files) {
      const decoded = decodeUTF8String(file.name);
      if (decoded !== file.name) {
        console.log(`[Migration] Healing file name: "${file.name}" -> "${decoded}"`);
        file.name = decoded;
        await file.save();
        fileCount++;
      }
    }
    console.log(`[Migration] Successfully healed ${fileCount} files.`);

  } catch (err) {
    console.error('[Migration Error] Failed to heal encodings:', err);
  }
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('[Migration Error] MONGO_URI is missing from environment!');
    process.exit(1);
  }
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Migration] Connected to MongoDB.');
    await healEncodings();
    console.log('[Migration] Completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Migration Error] Connection failed:', error);
    process.exit(1);
  }
};

run();
