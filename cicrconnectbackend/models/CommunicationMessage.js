const mongoose = require('mongoose');
const { applyModelEncryption } = require('../utils/modelEncryption');

const CommunicationMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      default: 'admin-stream',
      trim: true,
      maxlength: 80,
      index: true,
    },
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

const retentionDaysRaw = Number(process.env.COMMUNICATION_RETENTION_DAYS || 3);
const retentionDays =
  Number.isFinite(retentionDaysRaw) && retentionDaysRaw > 0 ? retentionDaysRaw : 3;

// Auto-delete message documents after configured retention period.
CommunicationMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: Math.round(60 * 60 * 24 * retentionDays) }
);
CommunicationMessageSchema.index({ conversationId: 1, createdAt: -1 });

applyModelEncryption(CommunicationMessageSchema, {
  encryptedPaths: [
    'text',
    'senderMeta.name',
    'senderMeta.collegeId',
    'senderMeta.role',
    'replyTo.text',
    'replyTo.senderName',
    'replyTo.senderCollegeId',
  ],
});

module.exports = mongoose.model('CommunicationMessage', CommunicationMessageSchema);
