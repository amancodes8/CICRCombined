const mongoose = require('mongoose');

const CommunicationMessageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    senderMeta: {
      name: { type: String, default: '' },
      collegeId: { type: String, default: '' },
      role: { type: String, default: '' },
      isAI: { type: Boolean, default: false },
    },
    replyTo: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunicationMessage' },
      text: { type: String, default: '' },
      senderName: { type: String, default: '' },
      senderCollegeId: { type: String, default: '' },
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// Auto-delete message documents after 3 days.
CommunicationMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 3 });

module.exports = mongoose.model('CommunicationMessage', CommunicationMessageSchema);
