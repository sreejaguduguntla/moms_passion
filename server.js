require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- API ENDPOINTS ---

// 1. Get Slot Availability
app.get('/api/availability', async (req, res) => {
  const { date } = req.query; // Expects YYYY-MM-DD
  if (!date) {
    return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD)" });
  }

  try {
    const settings = await db.getSettings();
    const appointments = await db.getAppointments();

    // Parse date to check day of week
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isDayBlocked = settings.blockedDays && settings.blockedDays.includes(date);

    // If day is blocked or is a weekend, no slots are available
    if (isDayBlocked || isWeekend) {
      return res.json({
        date,
        isBlocked: true,
        reason: isDayBlocked ? "Clinic is closed on this day." : "Clinic is closed on weekends.",
        slots: []
      });
    }

    const standardSlots = settings.standardSlots || ["18:30", "19:00", "19:30", "20:00"];
    const blockedSlotsMap = settings.blockedSlots || {};
    const manuallyBlocked = blockedSlotsMap[date] || [];

    // Get active bookings for this date
    const bookedTimes = appointments
      .filter(a => a.date === date && a.status === "scheduled")
      .map(a => a.time);

    // Build slots list with availability status
    const slots = standardSlots.map(time => {
      const isBooked = bookedTimes.includes(time);
      const isManuallyBlocked = manuallyBlocked.includes(time);
      return {
        time,
        available: !isBooked && !isManuallyBlocked,
        reason: isBooked ? "booked" : (isManuallyBlocked ? "blocked" : "available")
      };
    });

    res.json({
      date,
      isBlocked: false,
      slots
    });

  } catch (err) {
    console.error("Error checking availability:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Book Appointment (Patient)
app.post('/api/appointments', async (req, res) => {
  const { name, phone, email, age, gender, date, time, notes } = req.body;

  if (!name || !phone || !date || !time) {
    return res.status(400).json({ error: "Name, phone number, date, and time slot are required." });
  }

  try {
    // 1. Find or create patient
    let patient = await db.getPatientByPhone(phone);
    if (!patient) {
      patient = await db.createPatient({ name, phone, email, age, gender });
    }

    // 2. Book appointment
    const appointment = await db.createAppointment({
      patientId: patient.id,
      date,
      time,
      notes: notes || ""
    });

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully!",
      appointment,
      patient
    });

  } catch (err) {
    console.error("Error booking appointment:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// 3. Patient Lookup (Lookup history & diet chart)
app.post('/api/patient/lookup', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  try {
    const patient = await db.getPatientByPhone(phone);
    if (!patient) {
      return res.status(404).json({ error: "No records found for this phone number." });
    }

    // Get all appointments for this patient
    const allAppointments = await db.getAppointments();
    const appointments = allAppointments
      .filter(a => a.patientId === patient.id)
      .sort((a, b) => {
        // Sort by date desc, then time desc
        const dateCompare = b.date.localeCompare(a.date);
        return dateCompare !== 0 ? dateCompare : b.time.localeCompare(a.time);
      });

    res.json({
      success: true,
      patient,
      appointments
    });

  } catch (err) {
    console.error("Error looking up patient:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 4. Doctor Login
app.post('/api/doctor/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }

  const isValid = await db.verifyPassword(password);
  if (isValid) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid doctor access password." });
  }
});

// 5. Doctor: Get All Appointments (with patient details joined)
app.get('/api/doctor/appointments', async (req, res) => {
  try {
    const appts = await db.getAppointments();
    const patients = await db.getPatients();

    // Map patient details into appointments
    const joined = appts.map(appt => {
      const patient = patients.find(p => p.id === appt.patientId);
      return {
        ...appt,
        patientName: patient ? patient.name : "Unknown",
        patientPhone: patient ? patient.phone : "Unknown",
        patientAge: patient ? patient.age : "",
        patientGender: patient ? patient.gender : ""
      };
    }).sort((a, b) => {
      // Sort upcoming first (by date ascending, then time ascending)
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
    });

    res.json(joined);
  } catch (err) {
    console.error("Error fetching doctor appointments:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 6. Doctor: Update Appointment Status/Notes
app.post('/api/doctor/appointments/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status parameter is required." });
  }

  try {
    const updated = await db.updateAppointmentStatus(id, status, notes);
    if (!updated) {
      return res.status(404).json({ error: "Appointment not found." });
    }
    res.json({ success: true, appointment: updated });
  } catch (err) {
    console.error("Error updating appointment status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 7. Doctor: Get All Patients
app.get('/api/doctor/patients', async (req, res) => {
  try {
    const patients = await db.getPatients();
    res.json(patients);
  } catch (err) {
    console.error("Error fetching doctor patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 8. Doctor: Update Patient Diet Plan
app.post('/api/doctor/patients/:id/diet', async (req, res) => {
  const { id } = req.params;
  const { avoid, recommend, habits, acupressurePoints } = req.body;

  try {
    const updatedPatient = await db.updatePatientDiet(id, {
      avoid: avoid || [],
      recommend: recommend || [],
      habits: habits || "",
      acupressurePoints: acupressurePoints || ""
    });

    if (!updatedPatient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    res.json({ success: true, patient: updatedPatient });
  } catch (err) {
    console.error("Error updating patient diet plan:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 8b. Doctor: Update Patient Clinical Vitals & Record
app.post('/api/doctor/patients/:id/clinical', async (req, res) => {
  const { id } = req.params;
  const { 
    bp, temperature, pulseRate, bodyType, 
    urineColor, urineUrgency, urineFoaming, urineFrequency, urinePain, 
    bowelMovement, 
    tongueDescription, tongueImage 
  } = req.body;

  try {
    const updatedPatient = await db.updatePatientClinical(id, {
      bp: bp || "",
      temperature: temperature || "",
      pulseRate: pulseRate || "",
      bodyType: bodyType || "",
      urineColor: urineColor || "",
      urineUrgency: urineUrgency || "",
      urineFoaming: urineFoaming || "",
      urineFrequency: urineFrequency || "",
      urinePain: urinePain || "",
      bowelMovement: bowelMovement || "",
      tongueDescription: tongueDescription || "",
      tongueImage: tongueImage
    });

    if (!updatedPatient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    res.json({ success: true, patient: updatedPatient });
  } catch (err) {
    console.error("Error updating patient clinical record:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 9. Doctor: Get Settings & Custom Slot Rules
app.get('/api/doctor/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (err) {
    console.error("Error getting settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 10. Doctor: Block Specific Slot
app.post('/api/doctor/slots/block', async (req, res) => {
  const { date, time } = req.body;
  if (!date || !time) {
    return res.status(400).json({ error: "Date and time slot are required." });
  }
  try {
    await db.blockSlot(date, time);
    res.json({ success: true });
  } catch (err) {
    console.error("Error blocking slot:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 11. Doctor: Unblock Specific Slot
app.post('/api/doctor/slots/unblock', async (req, res) => {
  const { date, time } = req.body;
  if (!date || !time) {
    return res.status(400).json({ error: "Date and time slot are required." });
  }
  try {
    await db.unblockSlot(date, time);
    res.json({ success: true });
  } catch (err) {
    console.error("Error unblocking slot:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 12. Doctor: Block Entire Day
app.post('/api/doctor/slots/block-day', async (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ error: "Date is required." });
  }
  try {
    await db.blockDay(date);
    res.json({ success: true });
  } catch (err) {
    console.error("Error blocking day:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 13. Doctor: Unblock Entire Day
app.post('/api/doctor/slots/unblock-day', async (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ error: "Date is required." });
  }
  try {
    await db.unblockDay(date);
    res.json({ success: true });
  } catch (err) {
    console.error("Error unblocking day:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fallback to serve index.html for undefined routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server and Connect Database
async function startServer() {
  await db.connectDB();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` SAI RAM ACUPUNCTURE & ACUPRESSURE CLINIC SERVER`);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

startServer();
