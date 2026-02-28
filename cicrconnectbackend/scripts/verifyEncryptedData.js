#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Application = require('../models/Application');
const {
  ENC_PREFIX,
  normalizeEmail,
  normalizeCollegeId,
  normalizePhone,
} = require('../utils/fieldCrypto');

const limit = Number.parseInt(process.env.VERIFY_LIMIT || '0', 10);
const shouldFix = String(process.env.FIX_HASHES || '').trim().toLowerCase() === 'true';

const isEncryptedString = (value) =>
  typeof value === 'string' && value.startsWith(ENC_PREFIX);

const countFieldIssue = (summary, key) => {
  summary.issues[key] = (summary.issues[key] || 0) + 1;
};

const verifyUserRecord = async (doc, summary) => {
  const rawEmail = doc.get('email', null, { getters: false, virtuals: false });
  const rawCollegeId = doc.get('collegeId', null, { getters: false, virtuals: false });
  const rawPhone = doc.get('phone', null, { getters: false, virtuals: false });

  if (rawEmail && !isEncryptedString(rawEmail)) countFieldIssue(summary, 'user.email.plaintext');
  if (rawCollegeId && !isEncryptedString(rawCollegeId)) countFieldIssue(summary, 'user.collegeId.plaintext');
  if (rawPhone && !isEncryptedString(rawPhone)) countFieldIssue(summary, 'user.phone.plaintext');

  const email = normalizeEmail(doc.email);
  const collegeId = normalizeCollegeId(doc.collegeId);
  const phone = normalizePhone(doc.phone);

  const emailHashExpected = User.computeBlindIndex(email, normalizeEmail) || undefined;
  const collegeIdHashExpected = User.computeBlindIndex(collegeId, normalizeCollegeId) || undefined;
  const phoneHashExpected = User.computeBlindIndex(phone, normalizePhone) || undefined;

  let updated = false;
  if ((doc.emailHash || undefined) !== emailHashExpected) {
    countFieldIssue(summary, 'user.emailHash.mismatch');
    if (shouldFix) {
      doc.emailHash = emailHashExpected;
      updated = true;
    }
  }
  if ((doc.collegeIdHash || undefined) !== collegeIdHashExpected) {
    countFieldIssue(summary, 'user.collegeIdHash.mismatch');
    if (shouldFix) {
      doc.collegeIdHash = collegeIdHashExpected;
      updated = true;
    }
  }
  if ((doc.phoneHash || undefined) !== phoneHashExpected) {
    countFieldIssue(summary, 'user.phoneHash.mismatch');
    if (shouldFix) {
      doc.phoneHash = phoneHashExpected;
      updated = true;
    }
  }

  if (updated) {
    await doc.save({ validateBeforeSave: false });
    summary.fixed += 1;
  }
};

const verifyApplicationRecord = async (doc, summary) => {
  const rawEmail = doc.get('email', null, { getters: false, virtuals: false });
  const rawPhone = doc.get('phone', null, { getters: false, virtuals: false });

  if (rawEmail && !isEncryptedString(rawEmail)) countFieldIssue(summary, 'application.email.plaintext');
  if (rawPhone && !isEncryptedString(rawPhone)) countFieldIssue(summary, 'application.phone.plaintext');

  const email = normalizeEmail(doc.email);
  const phone = normalizePhone(doc.phone);
  const emailHashExpected = Application.computeBlindIndex(email, normalizeEmail) || undefined;
  const phoneHashExpected = Application.computeBlindIndex(phone, normalizePhone) || undefined;

  let updated = false;
  if ((doc.emailHash || undefined) !== emailHashExpected) {
    countFieldIssue(summary, 'application.emailHash.mismatch');
    if (shouldFix) {
      doc.emailHash = emailHashExpected;
      updated = true;
    }
  }
  if ((doc.phoneHash || undefined) !== phoneHashExpected) {
    countFieldIssue(summary, 'application.phoneHash.mismatch');
    if (shouldFix) {
      doc.phoneHash = phoneHashExpected;
      updated = true;
    }
  }
  if (updated) {
    await doc.save({ validateBeforeSave: false });
    summary.fixed += 1;
  }
};

const runModelScan = async ({ Model, name, verifyFn, summary }) => {
  let scanned = 0;
  const query = Model.find({});
  if (limit > 0) query.limit(limit);
  const cursor = query.cursor();

  for await (const doc of cursor) {
    scanned += 1;
    await verifyFn(doc, summary);
  }
  summary.scanned[name] = scanned;
};

const run = async () => {
  const summary = {
    scanned: {},
    issues: {},
    fixed: 0,
  };

  await connectDB();
  await runModelScan({
    Model: User,
    name: 'User',
    verifyFn: verifyUserRecord,
    summary,
  });
  await runModelScan({
    Model: Application,
    name: 'Application',
    verifyFn: verifyApplicationRecord,
    summary,
  });

  const issueCount = Object.values(summary.issues).reduce((sum, n) => sum + n, 0);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  if (issueCount > 0 && !shouldFix) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[verify-encryption] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
