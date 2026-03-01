const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedAnswer: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false }
);

const ContestAttemptSchema = new mongoose.Schema(
  {
    contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: [AnswerSchema], default: [] },
    score: { type: Number, min: 0, default: 0 },
    totalPoints: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['InProgress', 'Submitted'],
      default: 'InProgress',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ContestAttemptSchema.index({ contest: 1, member: 1 }, { unique: true });

module.exports = mongoose.model('ContestAttempt', ContestAttemptSchema);
