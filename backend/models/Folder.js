const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  color: { type: String, default: '#f59e0b' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Folder', folderSchema);
