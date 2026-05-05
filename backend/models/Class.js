const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Diákok listája az osztályban
  teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]  // Tanárok listája az osztályhoz
});

module.exports = mongoose.model('Class', classSchema);