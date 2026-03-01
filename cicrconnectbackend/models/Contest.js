const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, trim: true, maxlength: 1000 },
    questionType: {
      type: String,
      enum: ['MCQ', 'Text'],
      default: 'MCQ',
    },
    options: [{ type: String, trim: true, maxlength: 300 }],
    correctAnswer: { type: String, required: true, trim: true, maxlength: 300 },
    points: { type: Number, min: 1, max: 100, default: 10 },
  },
  { _id: true }
);

const ContestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    questions: { type: [QuestionSchema], default: [], validate: [arr => arr.length > 0, 'At least one question is required.'] },
    duration: { type: Number, min: 1, max: 300, default: 30 },
    audience: {
      type: String,
      enum: ['AllMembers', 'FirstYear', 'SecondYear', 'FirstAndSecond'],
      default: 'AllMembers',
      index: true,
    },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Closed'],
      default: 'Draft',
      index: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ContestSchema.index({ status: 1, audience: 1, startsAt: -1, endsAt: 1 });

module.exports = mongoose.model('Contest', ContestSchema);
