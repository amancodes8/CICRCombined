const Inventory = require('../models/Inventory');

// Get all components
exports.getInventory = async (req, res) => {
  try {
    const items = await Inventory.find().populate('issuedTo.user', 'name collegeId');
    res.json(items);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
};

// Add new component (Admin only)
exports.addComponent = async (req, res) => {
  try {
    const { totalQuantity } = req.body;
    const newItem = new Inventory({
      ...req.body,
      availableQuantity: totalQuantity 
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) { 
    res.status(400).json({ message: err.message }); 
  }
};

// Issue component to a member
exports.issueComponent = async (req, res) => {
  const { itemId, quantity, project } = req.body;
  const qty = Number(quantity);
  try {
    if (!itemId || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Valid itemId and positive integer quantity are required' });
    }
    if (!project || !String(project).trim()) {
      return res.status(400).json({ message: 'Project is required' });
    }

    const item = await Inventory.findById(itemId);
    if (!item || item.availableQuantity < qty) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    item.availableQuantity -= qty;
    item.issuedTo.push({ user: req.user.id, quantity: qty, project: String(project).trim() });
    await item.save();
    res.json({ message: 'Item issued successfully', item });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
};

// Adjust component stock (Admin/Head only)
exports.adjustComponentStock = async (req, res) => {
  const { itemId, mode, quantity } = req.body;
  const qty = Number(quantity);

  if (!itemId || !mode || !Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ message: 'itemId, mode(add/subtract), and positive integer quantity are required' });
  }

  if (!['add', 'subtract'].includes(mode)) {
    return res.status(400).json({ message: "mode must be 'add' or 'subtract'" });
  }

  try {
    const item = await Inventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const inUse = item.totalQuantity - item.availableQuantity;
    const delta = mode === 'add' ? qty : -qty;
    const newTotal = item.totalQuantity + delta;

    if (newTotal < inUse) {
      return res.status(400).json({
        message: `Cannot reduce below issued quantity (${inUse}). Return issued items first.`,
      });
    }

    item.totalQuantity = newTotal;
    item.availableQuantity = newTotal - inUse;
    await item.save();

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Compatibility endpoint: adjust by URL param
exports.adjustComponentStockById = async (req, res) => {
  return exports.adjustComponentStock(
    { ...req, body: { ...req.body, itemId: req.params.id } },
    res
  );
};
