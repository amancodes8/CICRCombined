const mongoose = require('mongoose');

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

const InviteCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    isUsed: {
        type: Boolean,
        default: false,
    },
    maxUses: {
        type: Number,
        default: 1,
        min: 1,
        max: 100,
    },
    currentUses: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastUsedAt: {
        type: Date,
        default: null,
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + INVITE_TTL_MS),
    },
}, { timestamps: true });

InviteCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('InviteCode', InviteCodeSchema);
