require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Post = require('../models/Post');
const CommunicationMessage = require('../models/CommunicationMessage');
const Application = require('../models/Application');
const IssueTicket = require('../models/IssueTicket');
const Meeting = require('../models/Meeting');
const Inventory = require('../models/Inventory');
const Event = require('../models/Event');
const { isEncryptionEnabled } = require('../utils/fieldCrypto');
const DRY_RUN = String(process.env.DRY_RUN || '').trim().toLowerCase() === 'true';

const migrateModel = async (Model, name) => {
  let scanned = 0;
  let updated = 0;

  const cursor = Model.find({}).cursor();
  for await (const doc of cursor) {
    scanned += 1;

    if (typeof doc.encryptLegacyConfiguredFields === 'function') {
      doc.encryptLegacyConfiguredFields();
    }

    if (!doc.isModified()) continue;
    if (!DRY_RUN) {
      await doc.save({ validateBeforeSave: false });
    }
    updated += 1;

    if (updated % 100 === 0) {
      // eslint-disable-next-line no-console
      console.log(`[migration] ${name}: updated ${updated}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[migration] ${name}: scanned ${scanned}, ${DRY_RUN ? 'would update' : 'updated'} ${updated}`);
};

const run = async () => {
  if (!isEncryptionEnabled()) {
    throw new Error(
      'Encryption key missing. Set DATA_ENCRYPTION_KEY (or JWT_SECRET fallback) before migration.'
    );
  }

  await connectDB();

  await migrateModel(User, 'User');
  await migrateModel(Application, 'Application');
  await migrateModel(Post, 'Post');
  await migrateModel(CommunicationMessage, 'CommunicationMessage');
  await migrateModel(IssueTicket, 'IssueTicket');
  await migrateModel(Meeting, 'Meeting');
  await migrateModel(Inventory, 'Inventory');
  await migrateModel(Event, 'Event');

  if (!DRY_RUN) {
    await User.syncIndexes();
    await Application.syncIndexes();
  }

  // eslint-disable-next-line no-console
  console.log(`[migration] Encryption migration ${DRY_RUN ? 'dry-run' : 'execution'} completed successfully.`);
};

run()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[migration] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
