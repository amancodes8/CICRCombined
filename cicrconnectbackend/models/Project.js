const mongoose = require('mongoose');

const PROJECT_STATUS_OPTIONS = [
  'Planning',
  'Active',
  'On-Hold',
  'Delayed',
  'Awaiting Review',
  'Completed',
  'Archived',
  'Ongoing',
];

const PROJECT_STAGE_OPTIONS = ['Planning', 'Execution', 'Testing', 'Review', 'Deployment'];
const PROJECT_UPDATE_TYPES = ['Comment', 'Blocker', 'Achievement', 'Status'];

const ProjectStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: PROJECT_STATUS_OPTIONS, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '', maxlength: 600 },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectUpdateSchema = new mongoose.Schema(
  {
    type: { type: String, enum: PROJECT_UPDATE_TYPES, default: 'Comment' },
    text: { type: String, required: true, trim: true, maxlength: 1600 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 5000 },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    domain: {
      type: String,
      enum: ['Tech', 'Management', 'PR'],
      default: 'Tech',
    },
    components: [{ type: String, trim: true, maxlength: 220 }],
    startTime: { type: Date, default: null },
    deadline: { type: Date, default: null },
    team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    guide: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    stage: {
      type: String,
      enum: PROJECT_STAGE_OPTIONS,
      default: 'Planning',
    },
    status: {
      type: String,
      enum: PROJECT_STATUS_OPTIONS,
      default: 'Planning',
    },
    statusHistory: { type: [ProjectStatusHistorySchema], default: [] },
    updates: { type: [ProjectUpdateSchema], default: [] },
    lastStatusChangedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    suggestions: [
      {
        text: { type: String, required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

ProjectSchema.index({ event: 1, status: 1, deadline: 1 });
ProjectSchema.index({ lead: 1 });
ProjectSchema.index({ team: 1 });
ProjectSchema.index({ guide: 1 });

module.exports = mongoose.model('Project', ProjectSchema);
