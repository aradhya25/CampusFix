const mongoose = require('mongoose');
const issueStatuses = ['open', 'in-progress', 'resolved', 'closed'];

const activitySchema = new mongoose.Schema({
  action: { type: String, enum: ['reported', 'status-change'], required: true },
  fromStatus: { type: String, enum: issueStatuses, default: null },
  toStatus: { type: String, enum: issueStatuses, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, trim: true, maxlength: 2000, default: '' },
  changedAt: { type: Date, default: Date.now },
});

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  format: { type: String, enum: ['jpg', 'jpeg', 'png', 'webp'], required: true },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  bytes: { type: Number, min: 1, max: 5 * 1024 * 1024, required: true },
}, { _id: false });

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 4, maxlength: 120 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  category: { type: String, required: true, enum: ['facilities', 'cleanliness', 'it', 'safety', 'other'] },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  resolutionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  activity: { type: [activitySchema], default: [] },
  image: { type: attachmentSchema, default: undefined },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

issueSchema.index({ createdBy: 1, createdAt: -1 });
issueSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('Issue', issueSchema);
