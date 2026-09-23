const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Patient = require('./models/Patient');
const Appointment = require('./models/Appointment');
const Settings = require('./models/Settings');

const SEED_FILE = path.join(__dirname, 'data', 'database.json');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('username:password')) {
    console.warn('\n=============================================================');
    console.warn('⚠️  MONGODB_URI contains placeholder credentials in .env!');
    console.warn('   Please update .env with your MongoDB Atlas connection URI.');
    console.warn('   Attempting local fallback at mongodb://127.0.0.1:27017/moms_passion...');
    console.warn('=============================================================\n');
  }

  const connectUri = (uri && !uri.includes('username:password')) 
    ? uri 
    : 'mongodb://127.0.0.1:27017/moms_passion';

  try {
    await mongoose.connect(connectUri);
    isConnected = true;
    console.log(`✅ Connected to MongoDB at: ${connectUri.split('@').pop() || connectUri}`);
    await initDB();
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
  }
}

// Seed initial data if DB is empty
async function initDB() {
  try {
    const patientCount = await Patient.countDocuments();
    if (patientCount === 0 && fs.existsSync(SEED_FILE)) {
      console.log('🌱 Seeding initial data from database.json into MongoDB...');
      const seedRaw = fs.readFileSync(SEED_FILE, 'utf8');
      const seedData = JSON.parse(seedRaw);

      if (seedData.patients && seedData.patients.length > 0) {
        await Patient.insertMany(seedData.patients);
        console.log(`   Seeded ${seedData.patients.length} patients.`);
      }

      if (seedData.appointments && seedData.appointments.length > 0) {
        await Appointment.insertMany(seedData.appointments);
        console.log(`   Seeded ${seedData.appointments.length} appointments.`);
      }

      if (seedData.settings) {
        await Settings.create(seedData.settings);
        console.log('   Seeded settings.');
      }
    } else {
      // Ensure default settings document exists
      const settingsCount = await Settings.countDocuments();
      if (settingsCount === 0) {
        await Settings.create({});
      }
    }
  } catch (err) {
    console.error('Error seeding initial data into MongoDB:', err.message);
  }
}

const db = {
  connectDB,

  // --- PATIENTS ---
  getPatients: async () => {
    return await Patient.find({}).lean();
  },

  getPatientById: async (id) => {
    return await Patient.findOne({ id }).lean();
  },

  getPatientByPhone: async (phone) => {
    const sanitized = phone.replace(/[^0-9]/g, '');
    const patients = await Patient.find({}).lean();
    return patients.find(p => p.phone && p.phone.replace(/[^0-9]/g, '') === sanitized) || null;
  },

  createPatient: async (patientData) => {
    const patients = await Patient.find({}).lean();
    const maxId = patients.reduce((max, p) => {
      const idNum = parseInt(p.id ? p.id.split('-')[1] : 0, 10);
      return idNum > max ? idNum : max;
    }, 1000);
    const newId = `P-${maxId + 1}`;

    const newPatient = new Patient({
      id: newId,
      name: patientData.name,
      phone: patientData.phone,
      email: patientData.email || '',
      age: patientData.age ? parseInt(patientData.age, 10) : null,
      gender: patientData.gender || '',
      createdAt: new Date(),
      dietPlan: {
        avoid: [],
        recommend: [],
        habits: '',
        acupressurePoints: '',
        updatedAt: new Date()
      },
      clinicalRecord: {
        bp: '',
        temperature: '',
        pulseRate: '',
        bodyType: '',
        tongueDescription: '',
        tongueImage: '',
        updatedAt: new Date()
      }
    });

    await newPatient.save();
    return newPatient.toObject();
  },

  updatePatientDiet: async (id, dietData) => {
    const patient = await Patient.findOne({ id });
    if (!patient) return null;

    patient.dietPlan = {
      avoid: Array.isArray(dietData.avoid) ? dietData.avoid : [dietData.avoid || ''],
      recommend: Array.isArray(dietData.recommend) ? dietData.recommend : [dietData.recommend || ''],
      habits: dietData.habits || '',
      acupressurePoints: dietData.acupressurePoints || '',
      updatedAt: new Date()
    };

    await patient.save();
    return patient.toObject();
  },

  updatePatientClinical: async (id, clinicalData) => {
    const patient = await Patient.findOne({ id });
    if (!patient) return null;

    const currentImage = patient.clinicalRecord ? patient.clinicalRecord.tongueImage : '';

    patient.clinicalRecord = {
      bp: clinicalData.bp || '',
      temperature: clinicalData.temperature || '',
      pulseRate: clinicalData.pulseRate || '',
      bodyType: clinicalData.bodyType || '',
      tongueDescription: clinicalData.tongueDescription || '',
      tongueImage: clinicalData.tongueImage !== undefined ? clinicalData.tongueImage : currentImage,
      updatedAt: new Date()
    };

    await patient.save();
    return patient.toObject();
  },

  // --- APPOINTMENTS ---
  getAppointments: async () => {
    return await Appointment.find({}).lean();
  },

  getAppointmentById: async (id) => {
    return await Appointment.findOne({ id }).lean();
  },

  createAppointment: async (apptData) => {
    const isBooked = await Appointment.findOne({
      date: apptData.date,
      time: apptData.time,
      status: 'scheduled'
    });

    if (isBooked) {
      throw new Error('This time slot has already been booked.');
    }

    const appointments = await Appointment.find({}).lean();
    const maxId = appointments.reduce((max, a) => {
      const idNum = parseInt(a.id ? a.id.split('-')[1] : 0, 10);
      return idNum > max ? idNum : max;
    }, 5000);
    const newId = `A-${maxId + 1}`;

    const newAppt = new Appointment({
      id: newId,
      patientId: apptData.patientId,
      date: apptData.date,
      time: apptData.time,
      status: 'scheduled',
      notes: apptData.notes || '',
      createdAt: new Date()
    });

    await newAppt.save();
    return newAppt.toObject();
  },

  updateAppointmentStatus: async (id, status, notes) => {
    const appt = await Appointment.findOne({ id });
    if (!appt) return null;

    appt.status = status;
    if (notes !== undefined) {
      appt.notes = notes;
    }

    await appt.save();
    return appt.toObject();
  },

  // --- SETTINGS AND SLOTS ---
  getSettings: async () => {
    let settings = await Settings.findOne({}).lean();
    if (!settings) {
      const created = await Settings.create({});
      settings = created.toObject();
    }
    // Normalize blockedSlots Map to standard JS object
    if (settings.blockedSlots instanceof Map) {
      settings.blockedSlots = Object.fromEntries(settings.blockedSlots);
    }
    return settings;
  },

  verifyPassword: async (password) => {
    const settings = await db.getSettings();
    return settings.doctorPassword === password;
  },

  updatePassword: async (newPassword) => {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings();
    }
    settings.doctorPassword = newPassword;
    await settings.save();
    return true;
  },

  getBlockedSlots: async (date) => {
    const settings = await db.getSettings();
    return (settings.blockedSlots && settings.blockedSlots[date]) ? settings.blockedSlots[date] : [];
  },

  blockSlot: async (date, time) => {
    let settings = await Settings.findOne({});
    if (!settings) settings = new Settings();

    if (!settings.blockedSlots) {
      settings.blockedSlots = new Map();
    }

    const current = settings.blockedSlots.get(date) || [];
    if (!current.includes(time)) {
      current.push(time);
      settings.blockedSlots.set(date, current);
      settings.markModified('blockedSlots');
      await settings.save();
    }
    return true;
  },

  unblockSlot: async (date, time) => {
    let settings = await Settings.findOne({});
    if (!settings || !settings.blockedSlots) return true;

    const current = settings.blockedSlots.get(date) || [];
    const updated = current.filter(t => t !== time);

    if (updated.length === 0) {
      settings.blockedSlots.delete(date);
    } else {
      settings.blockedSlots.set(date, updated);
    }
    settings.markModified('blockedSlots');
    await settings.save();
    return true;
  },

  blockDay: async (date) => {
    let settings = await Settings.findOne({});
    if (!settings) settings = new Settings();

    if (!settings.blockedDays.includes(date)) {
      settings.blockedDays.push(date);
      await settings.save();
    }
    return true;
  },

  unblockDay: async (date) => {
    let settings = await Settings.findOne({});
    if (!settings) return true;

    settings.blockedDays = settings.blockedDays.filter(d => d !== date);
    await settings.save();
    return true;
  }
};

module.exports = db;
