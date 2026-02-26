const mongoose = require('mongoose');

const ProjectIdeaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, required: true, trim: true, maxlength: 1400 },
    problemStatement: { type: String, default: '', trim: true, maxlength: 1800 },
    proposedStack: { type: String, default: '', trim: true, maxlength: 900 },
    tags: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['UnderReview', 'Approved', 'Rejected', 'Converted'],
      default: 'UnderReview',
      index: true,
    },
    reviewNote: { type: String, default: '', trim: true, maxlength: 1200 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    convertedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    convertedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ProjectIdeaSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ProjectIdea', ProjectIdeaSchema);
