const mongoose = require('mongoose');
const { applyModelEncryption } = require('../utils/modelEncryption');

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Announcement', 'Requirement', 'Idea', 'Event'], default: 'Announcement' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  topic: { type: String, trim: true, default: '' },
}, { timestamps: true });

applyModelEncryption(postSchema, {
  encryptedPaths: ['content', 'topic'],
});

module.exports = mongoose.model('Post', postSchema);
