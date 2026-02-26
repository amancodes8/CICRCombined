const mongoose = require('mongoose');

const WeeklyQuestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, default: '', trim: true, maxlength: 1200 },
    category: {
      type: String,
      enum: ['Technical', 'Design', 'Communication', 'Operations', 'Community'],
      default: 'Technical',
      index: true,
    },
    points: { type: Number, min: 1, max: 500, default: 40 },
    audience: {
      type: String,
      enum: ['AllMembers', 'FirstYear', 'SecondYear', 'FirstAndSecond'],
      default: 'FirstAndSecond',
      index: true,
    },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Closed', 'Archived'],
      default: 'Active',
      index: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

WeeklyQuestSchema.index({ status: 1, audience: 1, startsAt: -1, endsAt: 1 });

module.exports = mongoose.model('WeeklyQuest', WeeklyQuestSchema);
