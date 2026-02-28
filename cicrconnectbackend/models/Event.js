const mongoose = require('mongoose');
const { applyModelEncryption } = require('../utils/modelEncryption');

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 2400 },
    type: {
      type: String,
      enum: ['Orientation', 'Workshop', 'Recruitment', 'Competition', 'Seminar', 'Internal'],
      default: 'Internal',
    },
    location: { type: String, required: true, trim: true, maxlength: 220 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    capacity: { type: Number, default: null },
    allowApplications: { type: Boolean, default: false },
    applicationDeadline: { type: Date, default: null },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

EventSchema.index({ status: 1, startTime: 1 });
EventSchema.index({ allowApplications: 1, applicationDeadline: 1 });

applyModelEncryption(EventSchema, {
  encryptedPaths: ['title', 'description', 'location'],
});

module.exports = mongoose.model('Event', EventSchema);
