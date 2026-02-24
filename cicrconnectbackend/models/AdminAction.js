const mongoose = require('mongoose');

const adminActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['ADMIN_ROLE_CHANGE', 'ADMIN_DELETE'],
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    payload: {
      newRole: { type: String },
    },
    approvals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['Pending', 'Executed'],
      default: 'Pending',
    },
    executedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminAction', adminActionSchema);

