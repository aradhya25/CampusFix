const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 4, maxlength: 120 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  category: { type: String, required: true, enum: ['facilities', 'cleanliness', 'it', 'safety', 'other'] },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  resolutionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

issueSchema.index({ createdBy: 1, createdAt: -1 });
issueSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('Issue', issueSchema);
