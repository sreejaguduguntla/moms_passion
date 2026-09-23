const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  doctorPassword: { type: String, default: 'doctor123' },
  standardSlots: { type: [String], default: ['18:30', '19:00', '19:30', '20:00'] },
  blockedDays: { type: [String], default: [] },
  blockedSlots: { type: Map, of: [String], default: {} }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
