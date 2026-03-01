const mongoose = require('mongoose');

const ProgramConfigSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'default', trim: true },
    weeklyQuestsEnabled: { type: Boolean, default: true },
    mentorDeskEnabled: { type: Boolean, default: true },
    badgeSystemEnabled: { type: Boolean, default: true },
    ideaIncubatorEnabled: { type: Boolean, default: true },
    officeHoursEnabled: { type: Boolean, default: true },
    contestsEnabled: { type: Boolean, default: true },
    showProgramLeaderboard: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProgramConfig', ProgramConfigSchema);
