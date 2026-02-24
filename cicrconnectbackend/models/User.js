const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // Built-in Node module for token generation

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    collegeId: {
        type: String,
        required: [true, 'Please add a college ID'],
        unique: true,
        trim: true,
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
    password: { type: String, required: true },
    phone: { type: String },
    year: { type: Number },
    branch: { type: String },
    batch: { type: String },
    role: {
        type: String,
        enum: ['Admin', 'Head', 'User', 'Alumni'], 
        default: 'User'
    },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }], 
    projectIdeas: [{ type: String }],
    bio: { type: String, default: '' },
    achievements: [{ type: String }],
    skills: [{ type: String }],
    social: {
        linkedin: { type: String, default: '' },
        github: { type: String, default: '' },
        portfolio: { type: String, default: '' },
    },
    warnings: [{
        reason: { type: String, required: true },
        issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        issuedAt: { type: Date, default: Date.now },
        relatedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    }],
    warningCount: { type: Number, default: 0 },
    hasUnreadWarning: { type: Boolean, default: false },
    
    // --- FIELDS FOR ACCOUNT APPROVAL ---
    isVerified: {
        type: Boolean,
        default: false, // Account cannot login until admin approval
    },
    approvalStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    passwordResetOtp: String,
    passwordResetOtpExpires: Date,

}, { timestamps: true });

// Encrypt password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare entered password with hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// --- NEW METHOD: GENERATE VERIFICATION TOKEN ---
UserSchema.methods.createVerificationToken = function() {
    // Generate a random 32-character hex string
    const token = crypto.randomBytes(20).toString('hex');

    // Hash the token to save it in the database (security best practice)
    this.verificationToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    // Token expires in 24 hours
    this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

    return token; // Return the unhashed token to send via email
};

module.exports = mongoose.model('User', UserSchema);
