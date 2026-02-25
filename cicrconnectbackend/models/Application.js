const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 24 },
    year: { type: Number, min: 1, max: 6 },
    branch: { type: String, default: '', trim: true, maxlength: 80 },
    college: { type: String, default: '', trim: true, maxlength: 120 },
    interests: [{ type: String, trim: true, maxlength: 80 }],
    motivation: { type: String, default: '', maxlength: 2400 },
    experience: { type: String, default: '', maxlength: 2400 },
    availability: { type: String, default: '', maxlength: 240 },
    socials: {
      linkedin: { type: String, default: '', maxlength: 200 },
      github: { type: String, default: '', maxlength: 200 },
      portfolio: { type: String, default: '', maxlength: 200 },
    },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    status: {
      type: String,
      enum: ['New', 'InReview', 'Interview', 'Accepted', 'Selected', 'Rejected'],
      default: 'New',
    },
    stage: { type: String, default: 'Round 1', maxlength: 40 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: [
      {
        text: { type: String, required: true, maxlength: 1200 },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    history: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: '', maxlength: 600 },
      },
    ],
    inviteCode: { type: String, default: '' },
    inviteSentAt: { type: Date, default: null },
    inviteSentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, default: '', maxlength: 120 },
    ip: { type: String, default: '', maxlength: 64 },
    userAgent: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true }
);

ApplicationSchema.index({ status: 1, createdAt: -1 });
ApplicationSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('Application', ApplicationSchema);
