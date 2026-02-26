const mongoose = require('mongoose');

const OfficeHourBookingSchema = new mongoose.Schema(
  {
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeHourSlot', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    note: { type: String, default: '', trim: true, maxlength: 1200 },
    status: {
      type: String,
      enum: ['Booked', 'Cancelled', 'Completed', 'NoShow'],
      default: 'Booked',
      index: true,
    },
    bookedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

OfficeHourBookingSchema.index({ slot: 1, member: 1 }, { unique: true });
OfficeHourBookingSchema.index({ member: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('OfficeHourBooking', OfficeHourBookingSchema);
