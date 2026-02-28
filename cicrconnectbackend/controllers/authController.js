const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const {
  normalizeEmail,
  normalizeCollegeId,
} = require('../utils/fieldCrypto');
const {
  YEAR_MIN,
  YEAR_MAX,
  normalizeAlumniProfile,
  validateTenures,
} = require('../utils/alumniProfile');

const AUTH_RECOVERY_SELECT =
  'name email collegeId password role warningCount hasUnreadWarning approvalStatus isVerified +emailHash +collegeIdHash';

const findUserByIdentifierRecovery = async ({ normalizedEmail, normalizedCollegeId }) => {
  const cursor = User.find({}).select(AUTH_RECOVERY_SELECT).cursor();
  for await (const row of cursor) {
    const rowEmail = normalizeEmail(row.get('email'));
    const rowCollegeId = normalizeCollegeId(row.get('collegeId'));
    if (normalizedEmail && rowEmail && rowEmail === normalizedEmail) {
      return row;
    }
    if (normalizedCollegeId && rowCollegeId && rowCollegeId === normalizedCollegeId) {
      return row;
    }
  }
  return null;
};

const findUserByEmailAndCollegeIdRecovery = async ({ normalizedEmail, normalizedCollegeId }) => {
  const cursor = User.find({}).select(AUTH_RECOVERY_SELECT).cursor();
  for await (const row of cursor) {
    const rowEmail = normalizeEmail(row.get('email'));
    const rowCollegeId = normalizeCollegeId(row.get('collegeId'));
    if (
      normalizedEmail &&
      normalizedCollegeId &&
      rowEmail === normalizedEmail &&
      rowCollegeId === normalizedCollegeId
    ) {
      return row;
    }
  }
  return null;
};

const repairIdentityHashesIfNeeded = async (user) => {
  if (!user) return;
  const email = normalizeEmail(user.get('email'));
  const collegeId = normalizeCollegeId(user.get('collegeId'));

  const emailHashes =
    typeof User.computeBlindIndexVariants === 'function'
      ? User.computeBlindIndexVariants(email, normalizeEmail)
      : [User.computeBlindIndex(email, normalizeEmail)].filter(Boolean);
  const collegeIdHashes =
    typeof User.computeBlindIndexVariants === 'function'
      ? User.computeBlindIndexVariants(collegeId, normalizeCollegeId)
      : [User.computeBlindIndex(collegeId, normalizeCollegeId)].filter(Boolean);

  const expectedEmailHash = emailHashes[0] || undefined;
  const expectedCollegeIdHash = collegeIdHashes[0] || undefined;

  let changed = false;
  if ((user.emailHash || undefined) !== expectedEmailHash) {
    user.emailHash = expectedEmailHash;
    changed = true;
  }
  if ((user.collegeIdHash || undefined) !== expectedCollegeIdHash) {
    user.collegeIdHash = expectedCollegeIdHash;
    changed = true;
  }
  if (!changed) return;

  try {
    await user.save({ validateBeforeSave: false });
  } catch {
    // Do not block login/reset flow if self-heal fails.
  }
};

const normalizeHandle = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      return path.split('/')[0] || '';
    } catch {
      return raw.replace(/^@+/, '');
    }
  }

  return raw.replace(/^@+/, '');
};

const normalizeAvatarUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString().slice(0, 600);
  } catch {
    return null;
  }
};

const registerUser = async (req, res) => {
  const { name, email, password, collegeId, inviteCode, joinedAt } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);
  const normalizedInviteCode = String(inviteCode || '').trim().toUpperCase();

  if (!normalizedName || !normalizedEmail || !password || !normalizedCollegeId || !normalizedInviteCode) {
    return res.status(400).json({ message: 'All fields required' });
  }

  const emailHashes = typeof User.computeBlindIndexVariants === 'function'
    ? User.computeBlindIndexVariants(normalizedEmail, normalizeEmail)
    : [User.computeBlindIndex(normalizedEmail, normalizeEmail)].filter(Boolean);
  const collegeIdHashes = typeof User.computeBlindIndexVariants === 'function'
    ? User.computeBlindIndexVariants(normalizedCollegeId, normalizeCollegeId)
    : [User.computeBlindIndex(normalizedCollegeId, normalizeCollegeId)].filter(Boolean);
  const userExists = await User.findOne({
    $or: [
      ...(emailHashes.length ? [{ emailHash: { $in: emailHashes } }] : []),
      ...(collegeIdHashes.length ? [{ collegeIdHash: { $in: collegeIdHashes } }] : []),
      { email: normalizedEmail },
      { collegeId: normalizedCollegeId },
    ],
  });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const now = new Date();
  const code = await InviteCode.findOne({ code: normalizedInviteCode });
  if (!code) {
    return res.status(400).json({ message: 'Invalid invite code' });
  }

  if (code.expiresAt && new Date(code.expiresAt) <= now) {
    return res.status(400).json({ message: 'Invite code expired' });
  }

  const maxUsesRaw = Number(code.maxUses);
  const maxUses = Number.isInteger(maxUsesRaw) && maxUsesRaw > 0 ? maxUsesRaw : 1;
  const currentUsesRaw = Number(code.currentUses);
  const currentUses = Number.isInteger(currentUsesRaw) && currentUsesRaw >= 0
    ? currentUsesRaw
    : (code.isUsed ? maxUses : 0);

  if (currentUses >= maxUses || code.isUsed) {
    return res.status(400).json({ message: 'Invite code usage limit reached' });
  }

  const consumedCode = await InviteCode.findOneAndUpdate(
    {
      _id: code._id,
      expiresAt: { $gt: now },
      $or: [
        { currentUses: { $lt: maxUses } },
        { currentUses: { $exists: false } },
      ],
      isUsed: { $ne: true },
    },
    {
      $inc: { currentUses: 1 },
      $set: { lastUsedAt: now },
    },
    { new: true }
  );

  if (!consumedCode) {
    return res.status(400).json({ message: 'Invite code usage limit reached' });
  }

  const consumedMaxUsesRaw = Number(consumedCode.maxUses);
  const consumedMaxUses = Number.isInteger(consumedMaxUsesRaw) && consumedMaxUsesRaw > 0
    ? consumedMaxUsesRaw
    : 1;

  if (Number(consumedCode.currentUses || 0) >= consumedMaxUses && !consumedCode.isUsed) {
    consumedCode.isUsed = true;
    await consumedCode.save({ validateBeforeSave: false });
  }

  try {
    await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
      collegeId: normalizedCollegeId,
      joinedAt: joinedAt ? new Date(joinedAt) : undefined,
      isVerified: false,
      approvalStatus: 'Pending',
    });
  } catch (err) {
    // Best-effort rollback for invite usage count if user creation fails.
    try {
      const rollbackCode = await InviteCode.findById(consumedCode._id);
      if (rollbackCode) {
        const rollbackMaxUses = Number.isInteger(Number(rollbackCode.maxUses)) && Number(rollbackCode.maxUses) > 0
          ? Number(rollbackCode.maxUses)
          : 1;
        rollbackCode.currentUses = Math.max(0, Number(rollbackCode.currentUses || 0) - 1);
        rollbackCode.isUsed = rollbackCode.currentUses >= rollbackMaxUses;
        if (rollbackCode.currentUses === 0) {
          rollbackCode.lastUsedAt = null;
        }
        await rollbackCode.save({ validateBeforeSave: false });
      }
    } catch {
      // Ignore rollback failures.
    }
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'User already exists' });
    }
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Your account is pending admin approval.'
  });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const identifier = String(email || '').trim();
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedCollegeId = normalizeCollegeId(identifier);

  let user = null;
  if (identifier.includes('@')) {
    user = await User.findOneByEmail(normalizedEmail);
  } else {
    user = await User.findOneByCollegeId(normalizedCollegeId);
  }
  if (!user) {
    // Compatibility fallback: try both paths in case identifier format is ambiguous.
    user = (await User.findOneByEmail(normalizedEmail)) || (await User.findOneByCollegeId(normalizedCollegeId));
  }
  if (!user) {
    // Recovery fallback for old/misaligned encrypted hash records.
    user = await findUserByIdentifierRecovery({ normalizedEmail, normalizedCollegeId });
  }
  if (user) {
    await repairIdentityHashesIfNeeded(user);
  }
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
  }

  const approval = String(user.approvalStatus || '').trim().toLowerCase();

  if (approval === 'rejected') {
    return res.status(403).json({ message: 'Your registration has been rejected. Contact admin.' });
  }

  const isApproved = user.isVerified || approval === 'approved';
  if (!isApproved) {
    return res.status(401).json({
      code: 'ACCOUNT_PENDING_APPROVAL',
      message: 'Account pending admin approval',
    });
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

const resetPasswordWithCode = async (req, res) => {
  const { collegeId, resetCode, newPassword } = req.body;
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedCollegeId || !resetCode || !newPassword) {
    return res.status(400).json({ message: 'College ID, reset code, and new password are required' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedCode = crypto.createHash('sha256').update(String(resetCode)).digest('hex');

  const candidates = await User.find({
    passwordResetOtp: hashedCode,
    passwordResetOtpExpires: { $gt: Date.now() },
  }).limit(20);
  const user = candidates.find(
    (row) => normalizeCollegeId(row.collegeId) === normalizedCollegeId
  );

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset code' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  return res.json({ success: true, message: 'Password changed successfully. Please sign in.' });
};

const changePassword = async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from current password.' });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const matches = await user.matchPassword(currentPassword);
  if (!matches) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  return res.json({ success: true, message: 'Password updated successfully.' });
};

const sendPasswordResetOtp = async (req, res) => {
  const { email, collegeId } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedEmail || !normalizedCollegeId) {
    return res.status(400).json({ message: 'Email and college ID are required' });
  }

  const user = await User.findOneByEmailAndCollegeId(normalizedEmail, normalizedCollegeId);
  const resolvedUser =
    user ||
    (await findUserByEmailAndCollegeIdRecovery({
      normalizedEmail,
      normalizedCollegeId,
    }));

  if (!resolvedUser) {
    return res.status(404).json({ success: false, message: 'User not found with provided email and college ID' });
  }

  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  resolvedUser.passwordResetOtp = hashedOtp;
  resolvedUser.passwordResetOtpExpires = Date.now() + 10 * 60 * 1000;
  await repairIdentityHashesIfNeeded(resolvedUser);
  await resolvedUser.save({ validateBeforeSave: false });

  await sendEmail({
    email: resolvedUser.email,
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
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedEmail || !normalizedCollegeId || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, college ID, OTP, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedOtp = crypto.createHash('sha256').update(String(otp)).digest('hex');

  const candidates = await User.find({
    passwordResetOtp: hashedOtp,
    passwordResetOtpExpires: { $gt: Date.now() },
  }).limit(20);
  const user = candidates.find(
    (row) =>
      normalizeEmail(row.email) === normalizedEmail &&
      normalizeCollegeId(row.collegeId) === normalizedCollegeId
  );

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
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Name is required.' });
      }
      user.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      user.phone = String(req.body.phone || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'year')) {
      const rawYear = String(req.body.year ?? '').trim();
      if (!rawYear) {
        user.year = undefined;
      } else {
        const parsedYear = Number(rawYear);
        if (!Number.isFinite(parsedYear) || parsedYear < 1 || parsedYear > 6) {
          return res.status(400).json({ message: 'Year must be a number between 1 and 6.' });
        }
        user.year = parsedYear;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'branch')) {
      user.branch = String(req.body.branch || '').trim().toUpperCase();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'batch')) {
      user.batch = String(req.body.batch || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'joinedAt')) {
      const rawJoinedAt = req.body.joinedAt;
      if (!rawJoinedAt) {
        user.joinedAt = user.joinedAt || Date.now();
      } else {
        const parsedDate = new Date(rawJoinedAt);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: 'Invalid joined date.' });
        }
        user.joinedAt = parsedDate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'projectIdeas')) {
      user.projectIdeas = Array.isArray(req.body.projectIdeas)
        ? req.body.projectIdeas.map((v) => String(v || '').trim()).filter(Boolean)
        : user.projectIdeas;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'bio')) {
      user.bio = String(req.body.bio || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'avatarUrl')) {
      const avatarUrl = normalizeAvatarUrl(req.body.avatarUrl);
      if (avatarUrl === null) {
        return res.status(400).json({ message: 'Profile picture URL must be a valid http/https URL.' });
      }
      user.avatarUrl = avatarUrl;
    }

    if (Array.isArray(req.body.achievements)) {
      user.achievements = req.body.achievements.map((v) => String(v || '').trim()).filter(Boolean);
    }

    if (Array.isArray(req.body.skills)) {
      user.skills = req.body.skills.map((v) => String(v || '').trim()).filter(Boolean);
    }

    user.social = {
      linkedin: String(req.body.social?.linkedin ?? user.social?.linkedin ?? '').trim(),
      github: String(req.body.social?.github ?? user.social?.github ?? '').trim(),
      portfolio: String(req.body.social?.portfolio ?? user.social?.portfolio ?? '').trim(),
      instagram: normalizeHandle(req.body.social?.instagram ?? user.social?.instagram ?? ''),
      facebook: normalizeHandle(req.body.social?.facebook ?? user.social?.facebook ?? ''),
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'alumniProfile')) {
      const normalizedAlumniProfile = normalizeAlumniProfile(req.body.alumniProfile, user.alumniProfile || {});
      const tenureValidation = validateTenures(normalizedAlumniProfile.tenures);
      if (!tenureValidation.ok) {
        return res.status(400).json({ message: tenureValidation.message });
      }
      if (
        Number.isFinite(normalizedAlumniProfile.graduationYear) &&
        (normalizedAlumniProfile.graduationYear < YEAR_MIN || normalizedAlumniProfile.graduationYear > YEAR_MAX)
      ) {
        return res
          .status(400)
          .json({ message: `Graduation year must be between ${YEAR_MIN} and ${YEAR_MAX}.` });
      }
      user.alumniProfile = normalizedAlumniProfile;
    }

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    return res.json(userResponse);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to update profile.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  resetPasswordWithCode,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  changePassword,
  getMe,
  updateProfile,
};
