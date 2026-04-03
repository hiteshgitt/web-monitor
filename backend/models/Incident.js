const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true
  },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['warning', 'error', 'offline'],
    required: true
  },
  message: { type: String, default: '' },
  lastChecked: { type: Date, default: Date.now }
});

incidentSchema.index({ websiteId: 1, startedAt: -1 });

module.exports = mongoose.model('Incident', incidentSchema);
