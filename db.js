const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');

// Default database structure with seed data
const defaultData = {
  patients: [
    {
      id: "P-1001",
      name: "Ramesh Kumar",
      phone: "9876543210",
      email: "ramesh@example.com",
      age: 45,
      gender: "Male",
      createdAt: "2026-08-25T10:00:00.000Z",
      dietPlan: {
        avoid: [
          "Ice cold water and cold carbonated drinks",
          "Deep-fried, heavy oils, and refined sugar",
          "Excess raw foods (salads/cold fruits) after sunset"
        ],
        recommend: [
          "Warm water infused with sliced ginger and cumin",
          "Steamed green leafy vegetables with minimal spices",
          "Millet-based warm porridge for breakfast"
        ],
        habits: "Walk for 15 minutes after dinner. Ensure sleeping by 10:30 PM to support liver meridian recovery.",
        acupressurePoints: "Press ST-36 (Zusanli) for 2 minutes daily to improve digestion. Press LI-4 (Hegu) for headaches or stress relief.",
        updatedAt: "2026-08-29T19:00:00.000Z"
      }
    },
    {
      id: "P-1002",
      name: "Anjali Rao",
      phone: "9123456789",
      email: "anjali@example.com",
      age: 34,
      gender: "Female",
      createdAt: "2026-08-27T11:30:00.000Z",
      dietPlan: {
        avoid: [
          "Processed dairy and cheese products",
          "Spicy pickles and fermented foods",
          "Caffeinated beverages after 3:00 PM"
        ],
        recommend: [
          "Warm chamomile and mint tea",
          "Cooked rice, lentils (dal), and bottle gourd curry",
          "Soaked almonds and walnuts in the morning"
        ],
        habits: "Practice deep breathing (Pranayama) for 10 minutes in the morning. Keep mobile phone away 1 hour before sleep.",
        acupressurePoints: "Press SP-6 (Sanyinjiao) for hormone balance and calming the mind (avoid deep pressure if pregnant). Press PC-6 (Neiguan) for anxiety.",
        updatedAt: "2026-08-29T19:15:00.000Z"
      }
    }
  ],
  appointments: [
    {
      id: "A-5001",
      patientId: "P-1001",
      date: "2026-08-31", // tomorrow
      time: "18:30",
      status: "scheduled",
      notes: "First follow-up on lower back stiffness and digestive bloating. Needles applied on BL-23, GV-4, ST-36.",
      createdAt: "2026-08-29T14:20:00.000Z"
    },
    {
      id: "A-5002",
      patientId: "P-1002",
      date: "2026-08-31", // tomorrow
      time: "19:30",
      status: "scheduled",
      notes: "Managing stress and migraine headaches. Points targeted: GB-20, LI-4, LV-3.",
      createdAt: "2026-08-29T15:10:00.000Z"
    }
  ],
  settings: {
    doctorPassword: "doctor123",
    // Time slots available per weekday (Monday - Friday)
    // 6:30 PM to 8:30 PM
    standardSlots: ["18:30", "19:00", "19:30", "20:00"],
    blockedDays: [], // list of YYYY-MM-DD
    blockedSlots: {} // mapping of YYYY-MM-DD -> list of blocked times (e.g. {"2026-09-01": ["19:00"]})
  }
};

function initDB() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
    console.log("Database initialized with seed data.");
  }
}

// Read database from file
function readDB() {
  initDB();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database file, returning default structure:", err);
    return defaultData;
  }
}

// Write database to file
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Error writing database file:", err);
    return false;
  }
}

const db = {
  // --- PATIENTS ---
  getPatients: () => {
    return readDB().patients;
  },

  getPatientById: (id) => {
    return readDB().patients.find(p => p.id === id) || null;
  },

  getPatientByPhone: (phone) => {
    const sanitized = phone.replace(/[^0-9]/g, '');
    return readDB().patients.find(p => p.phone.replace(/[^0-9]/g, '') === sanitized) || null;
  },

  createPatient: (patientData) => {
    const data = readDB();
    // Generate new patient ID
    const maxId = data.patients.reduce((max, p) => {
      const idNum = parseInt(p.id.split('-')[1]);
      return idNum > max ? idNum : max;
    }, 1000);
    const newId = `P-${maxId + 1}`;

    const newPatient = {
      id: newId,
      name: patientData.name,
      phone: patientData.phone,
      email: patientData.email || "",
      age: patientData.age ? parseInt(patientData.age) : null,
      gender: patientData.gender || "",
      createdAt: new Date().toISOString(),
      dietPlan: {
        avoid: [],
        recommend: [],
        habits: "",
        acupressurePoints: "",
        updatedAt: new Date().toISOString()
      }
    };

    data.patients.push(newPatient);
    writeDB(data);
    return newPatient;
  },

  updatePatientDiet: (id, dietData) => {
    const data = readDB();
    const patientIndex = data.patients.findIndex(p => p.id === id);
    if (patientIndex === -1) return null;

    data.patients[patientIndex].dietPlan = {
      avoid: Array.isArray(dietData.avoid) ? dietData.avoid : [dietData.avoid || ""],
      recommend: Array.isArray(dietData.recommend) ? dietData.recommend : [dietData.recommend || ""],
      habits: dietData.habits || "",
      acupressurePoints: dietData.acupressurePoints || "",
      updatedAt: new Date().toISOString()
    };

    writeDB(data);
    return data.patients[patientIndex];
  },

  // --- APPOINTMENTS ---
  getAppointments: () => {
    return readDB().appointments;
  },

  getAppointmentById: (id) => {
    return readDB().appointments.find(a => a.id === id) || null;
  },

  createAppointment: (apptData) => {
    const data = readDB();
    // Generate new Appt ID
    const maxId = data.appointments.reduce((max, a) => {
      const idNum = parseInt(a.id.split('-')[1]);
      return idNum > max ? idNum : max;
    }, 5000);
    const newId = `A-${maxId + 1}`;

    const newAppt = {
      id: newId,
      patientId: apptData.patientId,
      date: apptData.date, // YYYY-MM-DD
      time: apptData.time, // HH:MM
      status: "scheduled",
      notes: apptData.notes || "",
      createdAt: new Date().toISOString()
    };

    // Check if slot is already booked
    const isBooked = data.appointments.some(a => 
      a.date === apptData.date && 
      a.time === apptData.time && 
      a.status === "scheduled"
    );

    if (isBooked) {
      throw new Error("This time slot has already been booked.");
    }

    data.appointments.push(newAppt);
    writeDB(data);
    return newAppt;
  },

  updateAppointmentStatus: (id, status, notes) => {
    const data = readDB();
    const index = data.appointments.findIndex(a => a.id === id);
    if (index === -1) return null;

    data.appointments[index].status = status;
    if (notes !== undefined) {
      data.appointments[index].notes = notes;
    }
    
    writeDB(data);
    return data.appointments[index];
  },

  // --- SETTINGS AND SLOTS ---
  getSettings: () => {
    return readDB().settings;
  },

  verifyPassword: (password) => {
    return readDB().settings.doctorPassword === password;
  },

  updatePassword: (newPassword) => {
    const data = readDB();
    data.settings.doctorPassword = newPassword;
    writeDB(data);
    return true;
  },

  getBlockedSlots: (date) => {
    const settings = readDB().settings;
    return settings.blockedSlots[date] || [];
  },

  blockSlot: (date, time) => {
    const data = readDB();
    if (!data.settings.blockedSlots[date]) {
      data.settings.blockedSlots[date] = [];
    }
    if (!data.settings.blockedSlots[date].includes(time)) {
      data.settings.blockedSlots[date].push(time);
    }
    writeDB(data);
    return true;
  },

  unblockSlot: (date, time) => {
    const data = readDB();
    if (data.settings.blockedSlots[date]) {
      data.settings.blockedSlots[date] = data.settings.blockedSlots[date].filter(t => t !== time);
      if (data.settings.blockedSlots[date].length === 0) {
        delete data.settings.blockedSlots[date];
      }
      writeDB(data);
    }
    return true;
  },

  blockDay: (date) => {
    const data = readDB();
    if (!data.settings.blockedDays.includes(date)) {
      data.settings.blockedDays.push(date);
      writeDB(data);
    }
    return true;
  },

  unblockDay: (date) => {
    const data = readDB();
    data.settings.blockedDays = data.settings.blockedDays.filter(d => d !== date);
    writeDB(data);
    return true;
  }
};

// Initialize DB file immediately
initDB();

module.exports = db;
