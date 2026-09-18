let isDoctorAuthenticated = false;
let allAppointments = [];
let allPatients = [];
let slotSettings = null;

// Toast Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none; border:none; color:inherit; cursor:pointer; font-size:18px; margin-left:15px;">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Modal Helpers
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Switch Sidebar tabs
function switchDashboardTab(tabName) {
  document.querySelectorAll('.doc-menu-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.portal-section').forEach(sec => sec.classList.remove('active'));
  
  if (tabName === 'appts') {
    document.getElementById('menuAppts').classList.add('active');
    document.getElementById('panelAppts').classList.add('active');
    loadAppointments();
  } else if (tabName === 'patients') {
    document.getElementById('menuPatients').classList.add('active');
    document.getElementById('panelPatients').classList.add('active');
    loadPatients();
  } else if (tabName === 'slots') {
    document.getElementById('menuSlots').classList.add('active');
    document.getElementById('panelSlots').classList.add('active');
    
    // Set default config date to tomorrow if empty
    const dateInput = document.getElementById('slotConfigDate');
    if (!dateInput.value) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const y = tomorrow.getFullYear();
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const d = String(tomorrow.getDate()).padStart(2, '0');
      dateInput.value = `${y}-${m}-${d}`;
    }
    fetchSlotSettings();
  }
}

// Login
async function handleDoctorLogin(event) {
  event.preventDefault();
  const password = document.getElementById('doctorPassword').value;

  try {
    const res = await fetch('/api/doctor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    isDoctorAuthenticated = true;
    sessionStorage.setItem('doctorSession', 'true');
    
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('dashboardWrapper').style.display = 'flex';
    
    showToast("Successfully unlocked Doctor Portal.");
    
    // Load initial stats & view
    updateDashboardData();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Check Session on load
window.addEventListener('DOMContentLoaded', () => {
  const sessionActive = sessionStorage.getItem('doctorSession');
  if (sessionActive === 'true') {
    isDoctorAuthenticated = true;
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('dashboardWrapper').style.display = 'flex';
    updateDashboardData();
  }
});

// Logout
function handleLogout() {
  isDoctorAuthenticated = false;
  sessionStorage.removeItem('doctorSession');
  document.getElementById('loginGate').style.display = 'block';
  document.getElementById('dashboardWrapper').style.display = 'none';
  document.getElementById('doctorPassword').value = "";
}

// Global Dashboard Data fetch
async function updateDashboardData() {
  if (!isDoctorAuthenticated) return;
  await Promise.all([loadAppointments(), loadPatients()]);
  renderStats();
}

// Stats Calculation
function renderStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const todayApptsCount = allAppointments.filter(a => a.date === todayStr).length;
  const totalPatientsCount = allPatients.length;
  const scheduledCount = allAppointments.filter(a => a.status === 'scheduled').length;
  
  document.getElementById('statTodayAppts').textContent = todayApptsCount;
  document.getElementById('statTotalPatients').textContent = totalPatientsCount;
  document.getElementById('statPendingBookings').textContent = scheduledCount;
}

// 1. Load Appointments
async function loadAppointments() {
  try {
    const res = await fetch('/api/doctor/appointments');
    if (!res.ok) throw new Error("Failed to fetch appointments");
    allAppointments = await res.json();
    renderAppointmentsTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAppointmentsTable() {
  const tbody = document.getElementById('apptsTableBody');
  tbody.innerHTML = "";

  if (allAppointments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary">No appointments booked yet.</td></tr>`;
    return;
  }

  allAppointments.forEach(appt => {
    const tr = document.createElement('tr');
    
    const dateStr = new Date(appt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const [h, m] = appt.time.split(':');
    const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
    const displayHr = parseInt(h) > 12 ? parseInt(h) - 12 : (parseInt(h) === 0 ? 12 : parseInt(h));
    const timeStr = `${displayHr}:${m} ${ampm}`;

    const ageGender = [appt.patientAge ? `${appt.patientAge} yrs` : null, appt.patientGender].filter(Boolean).join(' / ') || '-';

    tr.innerHTML = `
      <td>
        <strong>${appt.patientName}</strong><br>
        <span style="font-size: 12px; color: var(--text-secondary);">${appt.patientPhone}</span>
      </td>
      <td>${ageGender}</td>
      <td>
        <strong>${dateStr}</strong><br>
        <span style="font-size: 12px; color: var(--text-secondary);">${timeStr}</span>
      </td>
      <td><span class="badge badge-${appt.status}">${appt.status}</span></td>
      <td style="max-width: 250px; font-size: 13px; color: var(--text-secondary);">
        ${appt.notes || '<em style="color:#aaa;">No notes added</em>'}
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openStatusModal('${appt.id}', '${appt.status}', \`${escapeJSString(appt.notes)}\`)">
          ✏️ Edit Status
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeJSString(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// 2. Load Patients
async function loadPatients() {
  try {
    const res = await fetch('/api/doctor/patients');
    if (!res.ok) throw new Error("Failed to fetch patients");
    allPatients = await res.json();
    renderPatientsTable(allPatients);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPatientsTable(list) {
  const tbody = document.getElementById('patientsTableBody');
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary">No patients found.</td></tr>`;
    return;
  }

  list.forEach(patient => {
    const tr = document.createElement('tr');
    
    const regDate = new Date(patient.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const ageGender = [patient.age ? `${patient.age} yrs` : null, patient.gender].filter(Boolean).join(' / ') || '-';

    tr.innerHTML = `
      <td><code>${patient.id}</code></td>
      <td><strong>${patient.name}</strong></td>
      <td>${patient.phone}</td>
      <td>${ageGender}</td>
      <td>${regDate}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="openDietModal('${patient.id}')">
          🍎 Custom Diet Chart
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Patient Registry Filter/Search
function filterPatients() {
  const query = document.getElementById('patientSearchInput').value.toLowerCase().trim();
  if (!query) {
    renderPatientsTable(allPatients);
    return;
  }
  const filtered = allPatients.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.phone.includes(query) || 
    p.id.toLowerCase().includes(query)
  );
  renderPatientsTable(filtered);
}

// --- DIET CHART MODAL DIALOG ---
function openDietModal(patientId) {
  const patient = allPatients.find(p => p.id === patientId);
  if (!patient) return;

  document.getElementById('dietPatientId').value = patient.id;
  document.getElementById('dietModalTitle').textContent = `Diet & Wellness for ${patient.name}`;

  const diet = patient.dietPlan || {};
  
  // Populate textareas with line-separated lists
  document.getElementById('dietAvoidInput').value = (diet.avoid || []).join('\n');
  document.getElementById('dietRecommendInput').value = (diet.recommend || []).join('\n');
  document.getElementById('dietHabitsInput').value = diet.habits || "";
  document.getElementById('dietAcupressureInput').value = diet.acupressurePoints || "";

  openModal('dietModal');
}

async function savePatientDiet() {
  const patientId = document.getElementById('dietPatientId').value;
  
  const avoid = document.getElementById('dietAvoidInput').value.split('\n').map(s => s.trim()).filter(Boolean);
  const recommend = document.getElementById('dietRecommendInput').value.split('\n').map(s => s.trim()).filter(Boolean);
  const habits = document.getElementById('dietHabitsInput').value.trim();
  const acupressurePoints = document.getElementById('dietAcupressureInput').value.trim();

  const payload = { avoid, recommend, habits, acupressurePoints };

  try {
    const res = await fetch(`/api/doctor/patients/${patientId}/diet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update diet plan");

    showToast("Diet chart saved successfully!");
    closeModal('dietModal');
    loadPatients(); // reload to get local updates

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- APPOINTMENT STATUS MODAL DIALOG ---
function openStatusModal(apptId, status, notes) {
  document.getElementById('statusApptId').value = apptId;
  document.getElementById('apptStatusSelect').value = status;
  document.getElementById('apptNotesInput').value = notes === 'undefined' ? '' : notes;
  openModal('statusModal');
}

async function saveApptStatus() {
  const apptId = document.getElementById('statusApptId').value;
  const status = document.getElementById('apptStatusSelect').value;
  const notes = document.getElementById('apptNotesInput').value.trim();

  try {
    const res = await fetch(`/api/doctor/appointments/${apptId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update appointment");

    showToast("Appointment status updated successfully.");
    closeModal('statusModal');
    updateDashboardData(); // Refresh table & metrics

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- SLOT SCHEDULER CONFIG ---
async function fetchSlotSettings() {
  const dateInput = document.getElementById('slotConfigDate');
  const configContent = document.getElementById('slotConfigContent');
  
  if (!dateInput.value) {
    configContent.style.display = 'none';
    return;
  }

  try {
    // 1. Get standard settings
    const settingsRes = await fetch('/api/doctor/settings');
    const settings = await settingsRes.json();
    slotSettings = settings;

    // 2. Fetch availability for selected date
    const availRes = await fetch(`/api/availability?date=${dateInput.value}`);
    const avail = await availRes.json();

    configContent.style.display = 'block';

    const btnBlockDay = document.getElementById('btnBlockDay');
    const slotsWrapper = document.getElementById('individualSlotsWrapper');
    const slotsGrid = document.getElementById('configSlotsGrid');

    // Parse weekday
    const dateObj = new Date(dateInput.value);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      btnBlockDay.disabled = true;
      btnBlockDay.textContent = "Weekend Closed";
      slotsWrapper.style.display = 'none';
      return;
    }

    btnBlockDay.disabled = false;
    slotsWrapper.style.display = 'block';

    // If day is blocked (in settings)
    const isDayBlocked = settings.blockedDays.includes(dateInput.value);
    if (isDayBlocked) {
      btnBlockDay.textContent = "Unblock Day";
      btnBlockDay.style.backgroundColor = "var(--color-primary)";
      btnBlockDay.style.borderColor = "var(--color-primary)";
      btnBlockDay.style.color = "#ffffff";
      slotsWrapper.style.display = 'none';
    } else {
      btnBlockDay.textContent = "Block Entire Day";
      btnBlockDay.style.backgroundColor = "#ef4444";
      btnBlockDay.style.borderColor = "#ef4444";
      btnBlockDay.style.color = "#ffffff";
      slotsWrapper.style.display = 'block';

      // Render slots grid with block status
      slotsGrid.innerHTML = "";
      
      const manuallyBlocked = settings.blockedSlots[dateInput.value] || [];

      settings.standardSlots.forEach(time => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "slot-btn";
        
        const [h, m] = time.split(':');
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
        const displayHr = parseInt(h) > 12 ? parseInt(h) - 12 : (parseInt(h) === 0 ? 12 : parseInt(h));
        btn.textContent = `${displayHr}:${m} ${ampm}`;

        const isBlocked = manuallyBlocked.includes(time);
        
        if (isBlocked) {
          btn.classList.add('disabled');
          btn.title = "Click to open slot";
          btn.addEventListener('click', () => unblockTimeSlot(dateInput.value, time));
        } else {
          btn.classList.add('selected'); // green active style
          btn.title = "Click to block slot";
          btn.addEventListener('click', () => blockTimeSlot(dateInput.value, time));
        }

        slotsGrid.appendChild(btn);
      });
    }

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Toggle Day Block Status
async function toggleBlockDay() {
  const date = document.getElementById('slotConfigDate').value;
  const isCurrentlyBlocked = slotSettings.blockedDays.includes(date);

  const endpoint = isCurrentlyBlocked ? '/api/doctor/slots/unblock-day' : '/api/doctor/slots/block-day';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });

    if (!res.ok) throw new Error("Failed to change day block setting");
    
    showToast(isCurrentlyBlocked ? "Day opened successfully." : "Day blocked successfully.");
    fetchSlotSettings();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Block Specific Slot
async function blockTimeSlot(date, time) {
  try {
    const res = await fetch('/api/doctor/slots/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time })
    });

    if (!res.ok) throw new Error("Failed to block slot");
    showToast(`Time slot ${time} blocked.`);
    fetchSlotSettings();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Unblock Specific Slot
async function unblockTimeSlot(date, time) {
  try {
    const res = await fetch('/api/doctor/slots/unblock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time })
    });

    if (!res.ok) throw new Error("Failed to unblock slot");
    showToast(`Time slot ${time} opened.`);
    fetchSlotSettings();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
