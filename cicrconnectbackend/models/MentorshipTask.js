const mongoose = require('mongoose');

const TaskUpdateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Open', 'InProgress', 'Blocked', 'Completed'],
      required: true,
    },
    note: { type: String, default: '', trim: true, maxlength: 1200 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MentorshipTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', trim: true, maxlength: 2800 },
    category: {
      type: String,
      enum: ['Project', 'Meeting', 'Learning', 'Operations'],
      default: 'Project',
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['Open', 'InProgress', 'Blocked', 'Completed'],
      default: 'Open',
      index: true,
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dueDate: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updates: { type: [TaskUpdateSchema], default: [] },
  },
  { timestamps: true }
);

MentorshipTaskSchema.index({ assignedBy: 1, createdAt: -1 });
MentorshipTaskSchema.index({ assignedTo: 1, createdAt: -1 });

module.exports = mongoose.model('MentorshipTask', MentorshipTaskSchema);
