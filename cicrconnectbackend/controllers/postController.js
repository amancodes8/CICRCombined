const Post = require('../models/Post');
const User = require('../models/User');

// @desc    Get all community posts
exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'name role branch year collegeId warningCount')
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a new post
exports.createPost = async (req, res) => {
  try {
    const isPrivileged = ['admin', 'head'].includes((req.user.role || '').toLowerCase());
    if (req.body.type === 'Event' && !isPrivileged) {
      return res.status(403).json({ message: 'Only Admin/Head can post Event updates' });
    }

    const post = new Post({
      content: req.body.content,
      type: req.body.type,
      topic: req.body.topic || req.body.type || 'General',
      user: req.user.id
    });
    await post.save();
    const populated = await post.populate('user', 'name role branch year collegeId warningCount');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Like/Unlike post
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const index = post.likes.indexOf(req.user.id);
    if (index === -1) {
      post.likes.push(req.user.id);
    } else {
      post.likes.splice(index, 1);
    }
    await post.save();
    const populated = await post.populate('user', 'name role branch year collegeId warningCount');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Delete post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const role = req.user.role?.toLowerCase();
    const isPrivileged = role === 'admin' || role === 'head';
    if (post.user.toString() !== req.user.id && !isPrivileged) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await post.deleteOne();
    res.json({ message: "Post removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.warnUserForPost = async (req, res) => {
  try {
    const role = req.user.role?.toLowerCase();
    const isPrivileged = role === 'admin' || role === 'head';
    if (!isPrivileged) {
      return res.status(403).json({ message: 'Only Admin/Head can warn users' });
    }

    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'Warning reason is required' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const targetUser = await User.findById(post.user);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    targetUser.warnings = targetUser.warnings || [];
    targetUser.warnings.unshift({
      reason: String(reason).trim(),
      issuedBy: req.user.id,
      relatedPost: post._id,
    });
    targetUser.warningCount = (targetUser.warningCount || 0) + 1;
    targetUser.hasUnreadWarning = true;
    await targetUser.save();

    res.json({
      success: true,
      message: `Warning issued to ${targetUser.name}`,
      warningCount: targetUser.warningCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
