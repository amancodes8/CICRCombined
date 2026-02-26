const mongoose = require('mongoose');

const BadgeRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 400 },
    icon: { type: String, default: 'Medal', trim: true, maxlength: 30 },
    criteriaType: {
      type: String,
      enum: ['PointsThreshold', 'QuestCompletions', 'IdeasConverted', 'MentorResolutions'],
      required: true,
      index: true,
    },
    criteriaValue: { type: Number, min: 1, max: 100000, required: true },
    isEnabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

BadgeRuleSchema.index({ isEnabled: 1, order: 1, createdAt: -1 });

module.exports = mongoose.model('BadgeRule', BadgeRuleSchema);
