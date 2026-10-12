const express = require('express');
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const { requireAuth, allowRoles } = require('../middleware/auth');
const { validate, isObject } = require('../middleware/validate');

const router = express.Router();
const categories = ['facilities', 'cleanliness', 'it', 'safety', 'other'];
const statuses = ['open', 'in-progress', 'resolved', 'closed'];
const priorities = ['low', 'medium', 'high'];
const createFields = ['title', 'description', 'category', 'location'];
const editableFields = [...createFields, 'status', 'priority'];

function issueInput({ body }, creating, staff = false) {
  const errors = [];
  if (!isObject(body)) return ['Request body must be a JSON object'];
  const allowed = creating ? createFields : staff ? editableFields : createFields;
  for (const field of Object.keys(body)) if (!allowed.includes(field)) errors.push(`Field '${field}' cannot be changed`);
  if (creating || 'title' in body) {
    if (typeof body.title !== 'string' || body.title.trim().length < 4 || body.title.trim().length > 120) errors.push('Title must be 4 to 120 characters');
  }
  if (creating || 'description' in body) {
    if (typeof body.description !== 'string' || body.description.trim().length < 10 || body.description.trim().length > 2000) errors.push('Description must be 10 to 2000 characters');
  }
  if (creating || 'category' in body) if (!categories.includes(body.category)) errors.push(`Category must be one of: ${categories.join(', ')}`);
  if (creating || 'location' in body) {
    if (typeof body.location !== 'string' || !body.location.trim() || body.location.trim().length > 120) errors.push('Location must be 1 to 120 characters');
  }
  if ('status' in body && !statuses.includes(body.status)) errors.push(`Status must be one of: ${statuses.join(', ')}`);
  if ('priority' in body && !priorities.includes(body.priority)) errors.push(`Priority must be one of: ${priorities.join(', ')}`);
  if (!creating && Object.keys(body).length === 0) errors.push('Provide at least one field to update');
  return errors;
}

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid issue ID' });
  return next();
}

function ownerFilter(req) {
  return req.user.role === 'student' ? { createdBy: req.user.id } : {};
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset)) {
    return res.status(400).json({ message: 'page must be >= 1 and limit must be between 1 and 100' });
  }
  const filter = ownerFilter(req);
  if (req.query.status !== undefined) {
    if (!statuses.includes(req.query.status)) return res.status(400).json({ message: `status must be one of: ${statuses.join(', ')}` });
    filter.status = req.query.status;
  }
  if (req.query.category) {
    if (!categories.includes(req.query.category)) return res.status(400).json({ message: `category must be one of: ${categories.join(', ')}` });
    filter.category = req.query.category;
  }
  if (req.query.priority) {
    if (!priorities.includes(req.query.priority)) return res.status(400).json({ message: `priority must be one of: ${priorities.join(', ')}` });
    filter.priority = req.query.priority;
  }
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 100) {
      return res.status(400).json({ message: 'search must be 100 characters or fewer' });
    }
    const search = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
    ];
  }

  const [issues, total] = await Promise.all([
    Issue.find(filter).populate('createdBy', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Issue.countDocuments(filter),
  ]);
  return res.json({ issues, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/stats', async (req, res) => {
  const match = req.user.role === 'student' ? { createdBy: req.user._id } : {};
  const [byStatus, byCategory] = await Promise.all([
    Issue.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Issue.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const statusCounts = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const { _id, count } of byStatus) statusCounts[_id] = count;
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  return res.json({ total, byStatus: statusCounts, byCategory: Object.fromEntries(byCategory.map(({ _id, count }) => [_id, count])) });
});

router.post('/', validate((req) => issueInput(req, true)), async (req, res) => {
  const issue = await Issue.create({ ...req.body, createdBy: req.user._id });
  return res.status(201).json({ issue });
});

router.get('/:id', validId, async (req, res) => {
  const issue = await Issue.findOne({ _id: req.params.id, ...ownerFilter(req) }).populate('createdBy', 'name email');
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  return res.json({ issue });
});

router.patch('/:id', validId, validate((req) => issueInput(req, false, req.user?.role === 'staff')), async (req, res) => {
  const filter = { _id: req.params.id, ...ownerFilter(req) };
  const issue = await Issue.findOneAndUpdate(filter, { $set: req.body }, { new: true, runValidators: true }).populate('createdBy', 'name email');
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  return res.json({ issue });
});

router.delete('/:id', validId, async (req, res) => {
  const issue = await Issue.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  return res.json({ message: 'Issue deleted' });
});

module.exports = router;
