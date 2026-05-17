const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gridFSId: { type: mongoose.Schema.Types.ObjectId, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  shareToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

fileSchema.index({ shareToken: 1 });

module.exports = mongoose.model('File', fileSchema);
