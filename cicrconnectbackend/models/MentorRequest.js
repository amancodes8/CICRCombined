const mongoose = require('mongoose');

const MentorRequestEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['Created', 'Accepted', 'Updated', 'Resolved', 'Closed', 'Reopened'],
      required: true,
    },
    note: { type: String, default: '', trim: true, maxlength: 1200 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MentorRequestSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topic: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1800 },
    urgency: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
      index: true,
    },
    preferredMode: {
      type: String,
      enum: ['Online', 'Offline', 'Either'],
      default: 'Either',
    },
    status: {
      type: String,
      enum: ['Open', 'Accepted', 'Resolved', 'Closed'],
      default: 'Open',
      index: true,
    },
    assignedMentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    resolutionNote: { type: String, default: '', trim: true, maxlength: 1200 },
    resolvedAt: { type: Date, default: null },
    events: { type: [MentorRequestEventSchema], default: [] },
  },
  { timestamps: true }
);

MentorRequestSchema.index({ status: 1, urgency: 1, createdAt: -1 });

module.exports = mongoose.model('MentorRequest', MentorRequestSchema);
