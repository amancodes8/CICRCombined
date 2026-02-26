const mongoose = require('mongoose');

const EngagementConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, trim: true },
    learningHubEnabled: { type: Boolean, default: true },
    allowFirstYear: { type: Boolean, default: true },
    allowSecondYear: { type: Boolean, default: true },
    allowSubmissions: { type: Boolean, default: true },
    showLeaderboard: { type: Boolean, default: true },
    spotlightTitle: { type: String, default: 'Growth Program', trim: true, maxlength: 80 },
    spotlightMessage: {
      type: String,
      default: 'Pick one track, finish one task each week, and keep building momentum.',
      trim: true,
      maxlength: 320,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EngagementConfig', EngagementConfigSchema);
