const express = require('express');
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const { requireAuth, allowRoles } = require('../middleware/auth');
const { validate, isObject } = require('../middleware/validate');
const { calculateSla } = require('../utils/sla');
const imageStorage = require('../services/cloudinary');
const { parseImage, validateImageSignature } = require('../middleware/imageUpload');

const router = express.Router();
const categories = ['facilities', 'cleanliness', 'it', 'safety', 'other'];
const statuses = ['open', 'in-progress', 'resolved', 'closed'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const studentFields = ['title', 'description', 'category', 'location'];
const createFields = [...studentFields, 'priority'];
const editableFields = [...studentFields, 'status', 'priority', 'resolutionNotes'];

function issueInput({ body }, creating, staff = false) {
  const errors = [];
  if (!isObject(body)) return ['Request body must be a JSON object'];
  const allowed = creating ? createFields : staff ? editableFields : studentFields;
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
  if ('resolutionNotes' in body && (typeof body.resolutionNotes !== 'string' || body.resolutionNotes.length > 2000)) errors.push('Resolution notes must be 2000 characters or fewer');
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

function withSla(issue) {
  const plainIssue = typeof issue.toObject === 'function' ? issue.toObject() : issue;
  return { ...plainIssue, sla: calculateSla(plainIssue) };
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
  const sort = req.query.sort ?? 'newest';
  if (!['newest', 'oldest', 'priority'].includes(sort)) {
    return res.status(400).json({ message: 'sort must be one of: newest, oldest, priority' });
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

  let issuesQuery;
  if (sort === 'priority') {
    issuesQuery = Issue.aggregate([
      { $match: filter },
      { $addFields: { priorityRank: { $switch: {
        branches: [
          { case: { $eq: ['$priority', 'urgent'] }, then: 4 },
          { case: { $eq: ['$priority', 'high'] }, then: 3 },
          { case: { $eq: ['$priority', 'medium'] }, then: 2 },
          { case: { $eq: ['$priority', 'low'] }, then: 1 },
        ],
        default: 0,
      } } } },
      { $sort: { priorityRank: -1, createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
      { $project: { priorityRank: 0 } },
    ]).then((issues) => Issue.populate(issues, { path: 'createdBy', select: 'name email' }));
  } else {
    issuesQuery = Issue.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: sort === 'oldest' ? 1 : -1 })
      .skip(offset)
      .limit(limit);
  }
  const [issues, total] = await Promise.all([issuesQuery, Issue.countDocuments(filter)]);
  return res.json({ issues: issues.map(withSla), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
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

router.post('/', parseImage, validateImageSignature, validate((req) => issueInput(req, true)), async (req, res) => {
  if (req.file && !imageStorage.isConfigured()) {
    return res.status(503).json({ message: 'Image uploads are not configured. Contact the CampusFix administrator.' });
  }
  const createdAt = new Date();
  let storedImage;
  try {
    if (req.file) {
      const uploaded = await imageStorage.uploadImage(req.file.buffer);
      storedImage = { ...uploaded, mimeType: req.file.mimetype };
    }
    const issue = await Issue.create({
      ...req.body,
      ...(storedImage && { image: storedImage }),
      createdBy: req.user._id,
      activity: [{ action: 'reported', fromStatus: null, toStatus: 'open', actor: req.user._id, changedAt: createdAt }],
    });
    return res.status(201).json({ issue: withSla(issue) });
  } catch (error) {
    if (storedImage) {
      try {
        await imageStorage.deleteImage(storedImage.publicId);
      } catch (cleanupError) {
        console.error('Could not remove unreferenced uploaded image:', cleanupError.message);
      }
    }
    if (req.file && !storedImage) {
      const providerStatus = Number(error.http_code || error.statusCode);
      const providerError = error.cloudinaryResponse || {
        httpStatus: providerStatus || null,
        errorCode: null,
        message: null,
      };
      console.error('Cloudinary image upload failed:', JSON.stringify(providerError));
      const message = providerStatus === 401
        ? 'Cloudinary rejected the backend credentials. Check that the cloud name, API key, and API secret belong to the same product environment. No issue was created.'
        : providerStatus === 403
          ? 'Cloudinary denied the upload. Check that this product environment API key can create uploads and that account upload restrictions allow them. No issue was created.'
          : 'Image upload failed. Please retry; no issue was created.';
      return res.status(502).json({ message, providerError });
    }
    throw error;
  }
});

router.get('/:id', validId, async (req, res) => {
  const issue = await Issue.findOne({ _id: req.params.id, ...ownerFilter(req) })
    .populate('createdBy', 'name email role')
    .populate('activity.actor', 'name role');
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  return res.json({ issue: withSla(issue) });
});

router.patch('/:id', validId, validate((req) => issueInput(req, false, req.user?.role === 'staff')), async (req, res) => {
  const filter = { _id: req.params.id, ...ownerFilter(req) };
  const update = { $set: req.body };
  let updateFilter = filter;
  let expectedStatus;

  if (req.user.role === 'staff' && req.body.status) {
    const current = await Issue.findOne(filter).select('status');
    if (!current) return res.status(404).json({ message: 'Issue not found' });
    if (current.status !== req.body.status) {
      expectedStatus = current.status;
      updateFilter = { ...filter, status: expectedStatus };
      update.$push = { activity: {
        action: 'status-change',
        fromStatus: current.status,
        toStatus: req.body.status,
        actor: req.user._id,
        note: req.body.resolutionNotes || '',
        changedAt: new Date(),
      } };
    }
  }

  const issue = await Issue.findOneAndUpdate(updateFilter, update, { new: true, runValidators: true })
    .populate('createdBy', 'name email role')
    .populate('activity.actor', 'name role');
  if (!issue && expectedStatus) {
    const stillExists = await Issue.exists(filter);
    if (stillExists) return res.status(409).json({ message: 'Issue status changed at the same time. Refresh and try again.' });
  }
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  return res.json({ issue: withSla(issue) });
});

router.delete('/:id', validId, async (req, res) => {
  const issue = await Issue.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });
  if (!issue) return res.status(404).json({ message: 'Issue not found' });
  return res.json({ message: 'Issue deleted' });
});

module.exports = router;
