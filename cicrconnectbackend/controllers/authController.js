const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

const registerUser = async (req, res) => {
  const { name, email, password, collegeId, inviteCode, joinedAt } = req.body;

  if (!name || !email || !password || !collegeId || !inviteCode) {
    return res.status(400).json({ message: 'All fields required' });
  }

  const userExists = await User.findOne({ $or: [{ email }, { collegeId }] });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const code = await InviteCode.findOne({ code: inviteCode });
  if (!code || code.isUsed || code.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Invalid invite code' });
  }

  await User.create({
    name,
    email,
    password,
    collegeId,
    joinedAt: joinedAt ? new Date(joinedAt) : undefined,
    isVerified: false,
    approvalStatus: 'Pending',
  });

  code.isUsed = true;
  await code.save();

  res.status(201).json({
    success: true,
    message: 'Registration successful. Your account is pending admin approval.'
  });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const approval = String(user.approvalStatus || '').trim().toLowerCase();

  if (approval === 'rejected') {
    return res.status(403).json({ message: 'Your registration has been rejected. Contact admin.' });
  }

  const isApproved = user.isVerified || approval === 'approved';
  if (!isApproved) {
    return res.status(401).json({ message: 'Account pending admin approval' });
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    warningCount: user.warningCount || 0,
    hasUnreadWarning: !!user.hasUnreadWarning,
    token: generateToken(user._id),
  });
};

const verifyEmail = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Email verification is no longer used. Please wait for admin approval.',
  });
};

const sendPasswordResetOtp = async (req, res) => {
  const { email, collegeId } = req.body;

  if (!email || !collegeId) {
    return res.status(400).json({ message: 'Email and college ID are required' });
  }

  const user = await User.findOne({ email, collegeId });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found with provided email and college ID' });
  }

  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  user.passwordResetOtp = hashedOtp;
  user.passwordResetOtpExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user.email,
    subject: 'CICR Password Reset OTP',
    message: `
      <p>Your password reset OTP is:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>This OTP is valid for 10 minutes.</p>
    `,
  });

  res.json({ success: true, message: 'OTP sent to your email.' });
};

const resetPasswordWithOtp = async (req, res) => {
  const { email, collegeId, otp, newPassword } = req.body;

  if (!email || !collegeId || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, college ID, OTP, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedOtp = crypto.createHash('sha256').update(String(otp)).digest('hex');

  const user = await User.findOne({
    email,
    collegeId,
    passwordResetOtp: hashedOtp,
    passwordResetOtpExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully. Please log in.' });
};

const getMe = async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('-password')
    .populate('warnings.issuedBy', 'name role');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(user);
};

const updateProfile = async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.name = req.body.name || user.name;
  user.phone = req.body.phone || user.phone;
  user.year = req.body.year || user.year;
  user.branch = req.body.branch || user.branch;
  user.batch = req.body.batch || user.batch;
  user.joinedAt = req.body.joinedAt ? new Date(req.body.joinedAt) : user.joinedAt;
  user.projectIdeas = req.body.projectIdeas || user.projectIdeas;
  user.bio = req.body.bio ?? user.bio;
  user.achievements = Array.isArray(req.body.achievements) ? req.body.achievements : user.achievements;
  user.skills = Array.isArray(req.body.skills) ? req.body.skills : user.skills;
  user.social = {
    linkedin: req.body.social?.linkedin ?? user.social?.linkedin ?? '',
    github: req.body.social?.github ?? user.social?.github ?? '',
    portfolio: req.body.social?.portfolio ?? user.social?.portfolio ?? '',
  };

  const updatedUser = await user.save();
  const userResponse = updatedUser.toObject();
  delete userResponse.password;

  res.json(userResponse);
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  getMe,
  updateProfile,
};
