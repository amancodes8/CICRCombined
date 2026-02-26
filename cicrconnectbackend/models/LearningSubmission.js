const mongoose = require('mongoose');

const SubmissionEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['Submitted', 'Resubmitted', 'Approved', 'NeedsRevision', 'Reopened'],
      required: true,
    },
    note: { type: String, default: '', trim: true, maxlength: 1200 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LearningSubmissionSchema = new mongoose.Schema(
  {
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningTrack', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    moduleIndex: { type: Number, required: true, min: 0 },
    taskIndex: { type: Number, required: true, min: 0 },
    taskTitle: { type: String, default: '', trim: true, maxlength: 140 },
    taskPoints: { type: Number, min: 0, max: 300, default: 0 },
    evidenceText: { type: String, default: '', trim: true, maxlength: 2000 },
    evidenceLink: { type: String, default: '', trim: true, maxlength: 280 },
    status: {
      type: String,
      enum: ['Submitted', 'UnderReview', 'Approved', 'NeedsRevision'],
      default: 'Submitted',
      index: true,
    },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '', trim: true, maxlength: 1200 },
    reviewedAt: { type: Date, default: null },
    pointsAwarded: { type: Number, min: 0, max: 500, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    events: { type: [SubmissionEventSchema], default: [] },
  },
  { timestamps: true }
);

LearningSubmissionSchema.index({ track: 1, member: 1, moduleIndex: 1, taskIndex: 1 }, { unique: true });
LearningSubmissionSchema.index({ member: 1, status: 1, updatedAt: -1 });
LearningSubmissionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('LearningSubmission', LearningSubmissionSchema);
