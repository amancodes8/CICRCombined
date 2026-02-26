const mongoose = require('mongoose');

const BadgeAwardSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    badgeRule: { type: mongoose.Schema.Types.ObjectId, ref: 'BadgeRule', required: true, index: true },
    pointsSnapshot: { type: Number, min: 0, default: 0 },
    awardedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'system', trim: true, maxlength: 30 },
  },
  { timestamps: true }
);

BadgeAwardSchema.index({ member: 1, badgeRule: 1 }, { unique: true });

module.exports = mongoose.model('BadgeAward', BadgeAwardSchema);
