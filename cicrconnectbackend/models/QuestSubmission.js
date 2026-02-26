const mongoose = require('mongoose');

const QuestSubmissionEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['Submitted', 'Resubmitted', 'Approved', 'Rejected', 'NeedsRevision'],
      required: true,
    },
    note: { type: String, default: '', trim: true, maxlength: 1200 },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const QuestSubmissionSchema = new mongoose.Schema(
  {
    quest: { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyQuest', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    evidenceText: { type: String, default: '', trim: true, maxlength: 2000 },
    evidenceLink: { type: String, default: '', trim: true, maxlength: 280 },
    status: {
      type: String,
      enum: ['Submitted', 'Approved', 'Rejected', 'NeedsRevision'],
      default: 'Submitted',
      index: true,
    },
    pointsAwarded: { type: Number, min: 0, max: 500, default: 0 },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: '', trim: true, maxlength: 1200 },
    reviewedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
    events: { type: [QuestSubmissionEventSchema], default: [] },
  },
  { timestamps: true }
);

QuestSubmissionSchema.index({ quest: 1, member: 1 }, { unique: true });
QuestSubmissionSchema.index({ member: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('QuestSubmission', QuestSubmissionSchema);
