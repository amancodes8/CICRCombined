const mongoose = require('mongoose');

const IssueTicketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category: {
      type: String,
      enum: ['General', 'Technical', 'Infrastructure', 'Event', 'Academic', 'Safety'],
      default: 'General',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Open', 'InReview', 'Resolved', 'Rejected'],
      default: 'Open',
    },
    adminNote: { type: String, default: '', maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

IssueTicketSchema.index({ status: 1, createdAt: -1 });
IssueTicketSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('IssueTicket', IssueTicketSchema);
