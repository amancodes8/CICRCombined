const mongoose = require('mongoose');

const OfficeHourSlotSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    topic: { type: String, default: '', trim: true, maxlength: 400 },
    mode: {
      type: String,
      enum: ['Online', 'Offline', 'Hybrid'],
      default: 'Online',
    },
    locationOrLink: { type: String, default: '', trim: true, maxlength: 240 },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    capacity: { type: Number, min: 1, max: 500, default: 8 },
    bookedCount: { type: Number, min: 0, default: 0 },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Open', 'Closed', 'Cancelled'],
      default: 'Open',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

OfficeHourSlotSchema.index({ status: 1, startTime: 1, mentor: 1 });

module.exports = mongoose.model('OfficeHourSlot', OfficeHourSlotSchema);
