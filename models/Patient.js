const mongoose = require('mongoose');

const dietPlanSchema = new mongoose.Schema({
  avoid: { type: [String], default: [] },
  recommend: { type: [String], default: [] },
  habits: { type: String, default: '' },
  acupressurePoints: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const clinicalRecordSchema = new mongoose.Schema({
  bp: { type: String, default: '' },
  temperature: { type: String, default: '' },
  pulseRate: { type: String, default: '' },
  bodyType: { type: String, default: '' },
  tongueDescription: { type: String, default: '' },
  tongueImage: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const patientSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  age: { type: Number, default: null },
  gender: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  dietPlan: { type: dietPlanSchema, default: () => ({}) },
  clinicalRecord: { type: clinicalRecordSchema, default: () => ({}) }
}, {
  timestamps: true
});

module.exports = mongoose.model('Patient', patientSchema);
