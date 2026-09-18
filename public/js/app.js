// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none; border:none; color:inherit; cursor:pointer; font-size:18px; margin-left:15px;">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Switch tabs in patient portal
function switchPortalTab(tabName) {
  const tabBook = document.getElementById('tabBook');
  const tabDiet = document.getElementById('tabDiet');
  const sectionBook = document.getElementById('sectionBook');
  const sectionDiet = document.getElementById('sectionDiet');

  if (tabName === 'book') {
    tabBook.classList.add('active');
    tabDiet.classList.remove('active');
    sectionBook.classList.add('active');
    sectionDiet.classList.remove('active');
  } else {
    tabBook.classList.remove('active');
    tabDiet.classList.add('active');
    sectionBook.classList.remove('active');
    sectionDiet.classList.add('active');
  }
}

// Theme Toggle
const themeToggleBtn = document.getElementById('themeToggleBtn');
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  themeToggleBtn.textContent = isDarkMode ? '☀️' : '🌙';
  localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false');
});

// Load persistent theme preference
window.addEventListener('DOMContentLoaded', () => {
  // Set default booking date to today or next weekday
  setDefaultBookingDate();
  
  const savedTheme = localStorage.getItem('darkMode');
  if (savedTheme === 'true') {
    document.body.classList.add('dark-mode');
    themeToggleBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    themeToggleBtn.textContent = '🌙';
  }
});

// Helper to set booking date. Mondays to Fridays only.
function setDefaultBookingDate() {
  const dateInput = document.getElementById('bookingDate');
  if (!dateInput) return;

  const today = new Date();
  
  // Set min date to today
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${year}-${month}-${day}`;

  // If today is Saturday (6) or Sunday (0), default to next Monday
  let defaultDate = new Date(today);
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 6) {
    defaultDate.setDate(today.getDate() + 2); // Sat -> Mon
  } else if (dayOfWeek === 0) {
    defaultDate.setDate(today.getDate() + 1); // Sun -> Mon
  }

  const defYear = defaultDate.getFullYear();
  const defMonth = String(defaultDate.getMonth() + 1).padStart(2, '0');
  const defDay = String(defaultDate.getDate()).padStart(2, '0');
  dateInput.value = `${defYear}-${defMonth}-${defDay}`;

  // Fetch slots for default date
  fetchAvailability();
}

// Fetch Slot Availability
async function fetchAvailability() {
  const dateInput = document.getElementById('bookingDate');
  const slotsContainer = document.getElementById('slotsContainer');
  const statusText = document.getElementById('slotsStatusText');
  const selectedTimeInput = document.getElementById('selectedTime');
  
  // Clear previous slot selection
  selectedTimeInput.value = "";

  if (!dateInput.value) {
    slotsContainer.innerHTML = "";
    statusText.textContent = "Please select a date to view slots.";
    return;
  }

  statusText.textContent = "Checking available slots...";
  slotsContainer.innerHTML = "";

  try {
    const res = await fetch(`/api/availability?date=${dateInput.value}`);
    const data = await res.json();

    if (data.isBlocked) {
      statusText.textContent = data.reason || "The clinic is closed on this day.";
      return;
    }

    if (!data.slots || data.slots.length === 0) {
      statusText.textContent = "No time slots configured for this date.";
      return;
    }

    statusText.textContent = "Click a slot to select it:";
    
    data.slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = "button";
      btn.className = "slot-btn";
      
      // format time (e.g. 18:30 -> 6:30 PM)
      const [hourStr, minStr] = slot.time.split(':');
      const hour = parseInt(hourStr);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      btn.textContent = `${displayHour}:${minStr} ${ampm}`;

      if (!slot.available) {
        btn.classList.add('disabled');
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          // Unselect previous
          document.querySelectorAll('.slot-btn.selected').forEach(el => el.classList.remove('selected'));
          
          // Select this one
          btn.classList.add('selected');
          selectedTimeInput.value = slot.time;
        });
      }

      slotsContainer.appendChild(btn);
    });

  } catch (err) {
    console.error("Error fetching slots:", err);
    statusText.textContent = "Failed to load time slots. Please try again.";
  }
}

// Handle Booking Submission
async function handleBookingSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('patientName').value.trim();
  const phone = document.getElementById('patientPhone').value.trim();
  const email = document.getElementById('patientEmail').value.trim();
  const age = document.getElementById('patientAge').value;
  const gender = document.getElementById('patientGender').value;
  const date = document.getElementById('bookingDate').value;
  const time = document.getElementById('selectedTime').value;
  const notes = document.getElementById('bookingNotes').value.trim();

  if (!time) {
    showToast("Please select an available time slot from the list.", "error");
    return;
  }

  const payload = { name, phone, email, age, gender, date, time, notes };

  try {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to book appointment.");
    }

    showToast(data.message || "Appointment booked successfully!");
    
    // Reset booking form except date and client details for convenience
    document.getElementById('bookingNotes').value = "";
    document.getElementById('selectedTime').value = "";
    
    // Refresh slots
    fetchAvailability();

    // Optionally set up phone field in lookup automatically for quick check
    document.getElementById('lookupPhone').value = phone;

  } catch (err) {
    showToast(err.message, "error");
  }
}

// Handle Patient Dashboard Lookup
async function handlePatientLookup() {
  const phoneInput = document.getElementById('lookupPhone');
  const resultsContainer = document.getElementById('lookupResults');
  
  const phone = phoneInput.value.trim();
  if (!phone || phone.length < 10) {
    showToast("Please enter a valid 10-digit mobile number.", "error");
    return;
  }

  try {
    const res = await fetch('/api/patient/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "No record found.");
    }

    const { patient, appointments } = data;

    // Display patient profile info
    document.getElementById('displayPatientName').textContent = patient.name;
    document.getElementById('displayPatientId').textContent = patient.id;
    document.getElementById('displayPatientPhone').textContent = formatPhone(patient.phone);
    
    const ageGender = [patient.age ? `${patient.age} yrs` : null, patient.gender].filter(Boolean).join(' / ') || 'Not specified';
    document.getElementById('displayPatientAgeGender').textContent = ageGender;
    
    const regDate = new Date(patient.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('displayPatientRegistered').textContent = regDate;

    // Display appointments
    const apptsListContainer = document.getElementById('displayApptsList');
    apptsListContainer.innerHTML = "";

    if (!appointments || appointments.length === 0) {
      apptsListContainer.innerHTML = "<p class='text-secondary text-center'>No appointments found.</p>";
    } else {
      appointments.forEach(appt => {
        const item = document.createElement('div');
        item.className = "appt-item";
        
        const dateStr = new Date(appt.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const [h, m] = appt.time.split(':');
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM';
        const displayHr = parseInt(h) > 12 ? parseInt(h) - 12 : (parseInt(h) === 0 ? 12 : parseInt(h));
        const timeStr = `${displayHr}:${m} ${ampm}`;

        item.innerHTML = `
          <div class="appt-info">
            <h4>${dateStr}</h4>
            <p>🕒 ${timeStr}</p>
            ${appt.notes ? `<p class="mt-1" style="font-size: 12px; color: var(--text-secondary);"><strong>Treatment Notes:</strong> ${appt.notes}</p>` : ''}
          </div>
          <span class="badge badge-${appt.status}">${appt.status}</span>
        `;
        apptsListContainer.appendChild(item);
      });
    }

    // Display Diet Chart
    const diet = patient.dietPlan;
    
    if (diet && diet.updatedAt) {
      const updatedDate = new Date(diet.updatedAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' });
      document.getElementById('dietLastUpdated').textContent = `Last updated: ${updatedDate}`;
    } else {
      document.getElementById('dietLastUpdated').textContent = "";
    }

    // Foods to Avoid
    const avoidList = document.getElementById('dietAvoidList');
    const avoidEmpty = document.getElementById('dietAvoidEmpty');
    avoidList.innerHTML = "";
    if (!diet.avoid || diet.avoid.length === 0 || (diet.avoid.length === 1 && diet.avoid[0] === "")) {
      avoidEmpty.style.display = "block";
    } else {
      avoidEmpty.style.display = "none";
      diet.avoid.forEach(item => {
        if (item.trim() !== "") {
          const li = document.createElement('li');
          li.textContent = item;
          avoidList.appendChild(li);
        }
      });
      if (avoidList.children.length === 0) avoidEmpty.style.display = "block";
    }

    // Foods to Recommend
    const recList = document.getElementById('dietRecommendList');
    const recEmpty = document.getElementById('dietRecommendEmpty');
    recList.innerHTML = "";
    if (!diet.recommend || diet.recommend.length === 0 || (diet.recommend.length === 1 && diet.recommend[0] === "")) {
      recEmpty.style.display = "block";
    } else {
      recEmpty.style.display = "none";
      diet.recommend.forEach(item => {
        if (item.trim() !== "") {
          const li = document.createElement('li');
          li.textContent = item;
          recList.appendChild(li);
        }
      });
      if (recList.children.length === 0) recEmpty.style.display = "block";
    }

    // Daily Habits
    const habitsText = document.getElementById('dietHabitsText');
    if (diet.habits && diet.habits.trim() !== "") {
      habitsText.textContent = diet.habits;
    } else {
      habitsText.textContent = "No specific lifestyle habits prescribed yet. Walk regularly, keep stress low, and drink warm water.";
    }

    // Acupressure points
    const acupressureText = document.getElementById('dietAcupressureText');
    if (diet.acupressurePoints && diet.acupressurePoints.trim() !== "") {
      acupressureText.textContent = diet.acupressurePoints;
    } else {
      acupressureText.textContent = "No acupressure self-massage points suggested yet.";
    }

    // Show results
    resultsContainer.style.display = "block";
    resultsContainer.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    showToast(err.message, "error");
    resultsContainer.style.display = "none";
  }
}

// Simple phone formatter helper
function formatPhone(phoneStr) {
  const cleaned = ('' + phoneStr).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `+91 ${match[1]} ${match[2]}-${match[3]}`;
  }
  return phoneStr;
}
