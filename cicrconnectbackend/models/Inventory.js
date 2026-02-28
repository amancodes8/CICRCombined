const mongoose = require('mongoose');
const { applyModelEncryption } = require('../utils/modelEncryption');

const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  category: { type: String, required: true },
  totalQuantity: { type: Number, required: true },
  availableQuantity: { type: Number, required: true },
  location: { type: String },
  issuedTo: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    quantity: { type: Number },
    project: { type: String },
    issueDate: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

applyModelEncryption(inventorySchema, {
  encryptedPaths: ['itemName', 'category', 'location', 'issuedTo.project'],
});

module.exports = mongoose.model('Inventory', inventorySchema);
