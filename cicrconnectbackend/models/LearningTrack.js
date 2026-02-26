const mongoose = require('mongoose');

const TrackResourceSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 280 },
    type: {
      type: String,
      enum: ['Doc', 'Video', 'Repo', 'Practice', 'Other'],
      default: 'Doc',
    },
  },
  { _id: false }
);

const TrackTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1200 },
    points: { type: Number, min: 0, max: 300, default: 10 },
    isRequired: { type: Boolean, default: true },
  },
  { _id: false }
);

const TrackModuleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 1200 },
    resources: { type: [TrackResourceSchema], default: [] },
    tasks: { type: [TrackTaskSchema], default: [] },
  },
  { _id: false }
);

const LearningTrackSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, default: '', trim: true, maxlength: 1200 },
    targetAudience: {
      type: String,
      enum: ['AllMembers', 'FirstYear', 'SecondYear', 'FirstAndSecond'],
      default: 'FirstAndSecond',
      index: true,
    },
    level: {
      type: String,
      enum: ['Foundation', 'Intermediate', 'Applied'],
      default: 'Foundation',
      index: true,
    },
    estimatedHours: { type: Number, min: 1, max: 300, default: 8 },
    tags: { type: [String], default: [] },
    modules: { type: [TrackModuleSchema], default: [] },
    featured: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0, index: true },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

LearningTrackSchema.index({ isArchived: 1, isPublished: 1, targetAudience: 1, order: 1, createdAt: -1 });

module.exports = mongoose.model('LearningTrack', LearningTrackSchema);
