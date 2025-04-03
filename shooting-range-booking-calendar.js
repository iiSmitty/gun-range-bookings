// This script uses Flatpickr to create a date picker that only allows Wed-Sat selection
document.addEventListener('DOMContentLoaded', function() {
    // First load the Flatpickr library
    const flatpickrScript = document.createElement('script');
    flatpickrScript.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    flatpickrScript.onload = initFlatpickr;
    document.head.appendChild(flatpickrScript);

    // Also load the Flatpickr CSS
    const flatpickrStyles = document.createElement('link');
    flatpickrStyles.rel = 'stylesheet';
    flatpickrStyles.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
    document.head.appendChild(flatpickrStyles);

    function initFlatpickr() {
        // Get the original date input
        const originalDateInput = document.getElementById('date');

        // Get reference to error display and other elements
        const bookingError = document.getElementById('booking-error');
        const rangeTypeInput = document.getElementById('range-type');

        // Store the original value if there is one
        const originalValue = originalDateInput.value;

        // Add a helper text below the date picker
        const helperText = document.createElement('div');
        helperText.className = 'field-hint';
        helperText.textContent = 'The shooting range is only open Wednesday through Saturday.';
        originalDateInput.parentNode.insertBefore(helperText, originalDateInput.nextSibling);

        // Initialize Flatpickr on the date input
        const datePicker = flatpickr(originalDateInput, {
            minDate: "today",
            dateFormat: "Y-m-d",

            // Enable only Wednesday (3), Thursday (4), Friday (5), and Saturday (6)
            enable: [
                function(date) {
                    const day = date.getDay();
                    return day >= 3 && day <= 6; // Wed-Sat
                }
            ],

            // When a date is selected
            onChange: function(selectedDates, dateStr) {
                // Reset any previous error message
                bookingError.style.display = 'none';

                // If the range type is also selected, check availability
                if (rangeTypeInput.value) {
                    // Call the existing checkAvailability function from your main script
                    if (typeof checkAvailability === 'function') {
                        checkAvailability();
                    }
                }
            }
        });

        // If there was a previously selected date, validate it
        if (originalValue) {
            const selectedDate = new Date(originalValue);
            const dayOfWeek = selectedDate.getDay();

            // If the date is not valid (not Wed-Sat), clear it
            if (dayOfWeek < 3 || dayOfWeek > 6) {
                originalDateInput.value = '';

                // Reset the time slots
                document.getElementById('time-slots').innerHTML =
                    '<div class="loading">Select a date and range type to see available slots</div>';

                // Disable book button
                document.getElementById('book-button').disabled = true;
            }
        }
    }
});

// API endpoint (Netlify function URL)
const API_URL = 'https://kraaifonteinrangebookings.netlify.app/.netlify/functions/bookings';

// Configuration
const MAX_CAPACITY = {
    ".22 Range": 5,  // 5 people per time slot
    "Rifle Range": 3  // 3 people per time slot
};

const TIME_SLOTS = [
    "09:00-10:00",
    "10:00-11:00",
    "11:00-12:00",
    "12:00-13:00",
    "13:00-14:00",
    "14:00-15:00",
    "15:00-16:00",
    "16:00-17:00"
];

// User state
let currentUser = {
    email: null,
    name: null,
    isLoggedIn: false
};

let selectedTimeSlot = null;

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const authContainer = document.getElementById('auth-container');
const loginForm = document.getElementById('login-form');
const loggedInView = document.getElementById('logged-in-view');
const userEmailDisplay = document.getElementById('user-email-display');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authNameInput = document.getElementById('auth-name');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const dateInput = document.getElementById('date');
const rangeTypeInput = document.getElementById('range-type');
const timeSlotsContainer = document.getElementById('time-slots');
const bookButton = document.getElementById('book-button');
const bookingsList = document.getElementById('bookings-list');
const authError = document.getElementById('auth-error');
const bookingError = document.getElementById('booking-error');

// Event Listeners
document.addEventListener('DOMContentLoaded', initialize);
loginButton.addEventListener('click', handleAuth);
logoutButton.addEventListener('click', handleLogout);
dateInput.addEventListener('change', checkAvailability);
rangeTypeInput.addEventListener('change', checkAvailability);
bookButton.addEventListener('click', createBooking);

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Only allow tab switching if logged in
        if (!currentUser.isLoggedIn && tab.dataset.tab === 'view-bookings') {
            alert('Please login first to view your bookings');
            return;
        }

        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// Set minimum date to today
const today = new Date().toISOString().split('T')[0];
dateInput.setAttribute('min', today);

// Initialize application
async function initialize() {
    // Set today's date as minimum for date picker
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    // Set default date to today
    dateInput.value = today;

    // Clear any session data for fresh start
    sessionStorage.removeItem('rangeBookingSession');
}

// Handle authentication (login/register)
async function handleAuth() {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();
    const name = authNameInput.value.trim();

    // Validate inputs
    if (!email) {
        showError(authError, 'Email is required');
        return;
    }

    if (!password || password.length < 4) {
        showError(authError, 'Password must be at least 4 characters');
        return;
    }

    loginButton.textContent = 'Verifying...';
    loginButton.disabled = true;

    try {
        // Try to verify credentials
        const response = await fetch(`${API_URL}/verify?email=${encodeURIComponent(email.toLowerCase())}&password=${encodeURIComponent(password)}`);

        if (response.ok) {
            // Successful login
            const data = await response.json();

            // Create secure session (in memory only, not stored)
            currentUser = {
                email: email,
                name: data[0]?.name || name,
                password: password, // Store temporarily in memory for API calls
                isLoggedIn: true
            };

            // Update UI
            updateUIAfterLogin();

            // Load bookings
            loadBookings();
        } else if (response.status === 401) {
            // User not found - this could be a new registration
            if (!name) {
                showError(authError, 'Please enter your full name to register');
                return;
            }

            const confirmRegister = confirm('No account found with these credentials. Would you like to register?');
            if (!confirmRegister) {
                loginButton.textContent = 'Login / Register';
                loginButton.disabled = false;
                return;
            }

            // Set user state for new user (memory only)
            currentUser = {
                email: email,
                name: name,
                password: password,
                isLoggedIn: true
            };

            // Update UI
            updateUIAfterLogin();

            // Show no bookings yet
            bookingsList.innerHTML = '<div class="no-bookings">No bookings found. Make your first booking now!</div>';
        } else {
            // Other error
            const errorData = await response.json();
            throw new Error(errorData.error || 'Authentication failed');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showError(authError, error.message || 'Failed to authenticate');
    } finally {
        loginButton.textContent = 'Login / Register';
        loginButton.disabled = false;
    }
}

// Update UI after successful login
function updateUIAfterLogin() {
    // Show logged in view
    loginForm.style.display = 'none';
    loggedInView.style.display = 'block';
    authContainer.classList.add('logged-in');

    // Update user display
    userEmailDisplay.textContent = currentUser.email;

    // Clear any auth errors
    authError.style.display = 'none';
}

// Handle logout
function handleLogout() {
    // Reset user state completely
    currentUser = {
        email: null,
        name: null,
        password: null,
        isLoggedIn: false
    };

    // Reset UI
    loginForm.style.display = 'block';
    loggedInView.style.display = 'none';
    authContainer.classList.remove('logged-in');

    // Clear form fields for security
    authEmailInput.value = '';
    authPasswordInput.value = '';
    authNameInput.value = '';

    // Reset booking list
    bookingsList.innerHTML = '<div class="loading">Login to view your bookings...</div>';

    // Switch to booking tab
    tabs[0].click();
}

// Load user bookings
async function loadBookings() {
    if (!currentUser.isLoggedIn || !currentUser.password) return;

    bookingsList.innerHTML = '<div class="loading">Loading your bookings...</div>';

    try {
        // Get bookings for the current user using the in-memory password
        const response = await fetch(`${API_URL}/verify?email=${encodeURIComponent(currentUser.email)}&password=${encodeURIComponent(currentUser.password)}`);

        if (!response.ok) {
            if (response.status === 401) {
                // Session expired
                handleLogout();
                throw new Error('Your session has expired. Please login again.');
            }
            throw new Error('Failed to load bookings');
        }

        const bookings = await response.json();
        renderBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
        bookingsList.innerHTML = '<div class="error-message">Failed to load your bookings. Please try again.</div>';
        alert(error.message);
    }
}

// Render bookings list
function renderBookings(bookings) {
    bookingsList.innerHTML = '';

    if (!bookings || bookings.length === 0) {
        bookingsList.innerHTML = '<div class="no-bookings">No upcoming bookings found.</div>';
        return;
    }

    // Filter only future bookings or today
    const todayDate = new Date().toISOString().split('T')[0];
    const futureBookings = bookings.filter(booking => booking.date >= todayDate);

    if (futureBookings.length === 0) {
        bookingsList.innerHTML = '<div class="no-bookings">No upcoming bookings found.</div>';
        return;
    }

    // Sort bookings by date and time
    futureBookings.sort((a, b) => {
        if (a.date === b.date) {
            return a.time_slot.localeCompare(b.time_slot);
        }
        return a.date.localeCompare(b.date);
    });

    // Create booking items
    futureBookings.forEach(booking => {
        const bookingItem = document.createElement('div');
        bookingItem.classList.add('booking-item');

        const bookingDate = new Date(booking.date);
        const formattedDate = bookingDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const bookingDetails = document.createElement('div');
        bookingDetails.classList.add('booking-details');
        bookingDetails.innerHTML = `
        <h3>${booking.range_type}</h3>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formatTimeSlot(booking.time_slot)}</p>
      `;

        const bookingActions = document.createElement('div');
        bookingActions.classList.add('booking-actions');

        const cancelButton = document.createElement('button');
        cancelButton.classList.add('danger');
        cancelButton.textContent = 'Cancel Booking';
        cancelButton.addEventListener('click', () => cancelBooking(booking.id));

        bookingActions.appendChild(cancelButton);
        bookingItem.appendChild(bookingDetails);
        bookingItem.appendChild(bookingActions);
        bookingsList.appendChild(bookingItem);
    });
}

// Check availability for the selected date and range
async function checkAvailability() {
    // Reset state
    timeSlotsContainer.innerHTML = '<div class="loading">Loading available slots...</div>';
    selectedTimeSlot = null;
    bookButton.disabled = true;
    bookingError.style.display = 'none';

    const date = dateInput.value;
    const rangeType = rangeTypeInput.value;

    if (!date || !rangeType) {
        timeSlotsContainer.innerHTML = '<div class="loading">Select a date and range type to see available slots</div>';
        return;
    }

    try {
        // Get current bookings for this date and range
        const response = await fetch(`${API_URL}?date=${date}&rangeType=${encodeURIComponent(rangeType)}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to load availability');
        }

        const bookings = await response.json();
        renderTimeSlots(bookings || [], date, rangeType);
    } catch (error) {
        console.error('Error checking availability:', error);
        showError(bookingError, error.message || 'Failed to load availability');
        timeSlotsContainer.innerHTML = '';
    }
}

// Render available time slots
function renderTimeSlots(bookings, date, rangeType) {
    timeSlotsContainer.innerHTML = '';

    // Group bookings by time slot
    const bookingsBySlot = {};
    TIME_SLOTS.forEach(slot => {
        bookingsBySlot[slot] = 0;
    });

    // Count bookings per slot
    bookings.forEach(booking => {
        if (bookingsBySlot.hasOwnProperty(booking.time_slot)) {
            bookingsBySlot[booking.time_slot]++;
        }
    });

    // Create slot elements
    TIME_SLOTS.forEach(timeSlot => {
        const slot = document.createElement('div');
        const bookedCount = bookingsBySlot[timeSlot];
        const maxCapacity = MAX_CAPACITY[rangeType];
        const isFull = bookedCount >= maxCapacity;

        slot.className = `slot ${isFull ? 'slot-full' : ''}`;
        slot.dataset.timeSlot = timeSlot;

        // Calculate capacity percentage
        const capacityPercentage = (bookedCount / maxCapacity) * 100;
        let capacityClass = '';

        if (capacityPercentage >= 100) {
            capacityClass = 'capacity-full';
        } else if (capacityPercentage >= 70) {
            capacityClass = 'capacity-warning';
        }

        slot.innerHTML = `
        <div>${formatTimeSlot(timeSlot)}</div>
        <div class="capacity-indicator">
          <span>${bookedCount}/${maxCapacity} booked</span>
        </div>
        <div class="capacity-bar ${capacityClass}">
          <div class="capacity-fill" style="width: ${Math.min(capacityPercentage, 100)}%"></div>
        </div>
      `;

        if (!isFull) {
            slot.addEventListener('click', () => selectTimeSlot(slot, timeSlot));
        }

        timeSlotsContainer.appendChild(slot);
    });

    if (timeSlotsContainer.children.length === 0) {
        timeSlotsContainer.innerHTML = '<p>No time slots available for the selected date.</p>';
    }
}

// Select a time slot
function selectTimeSlot(slotElement, timeSlot) {
    // First check if user is logged in
    if (!currentUser.isLoggedIn) {
        alert('Please login or register first before booking');
        authEmailInput.focus();
        return;
    }

    // Remove selection from all slots
    document.querySelectorAll('.slot.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Add selection to clicked slot
    slotElement.classList.add('selected');
    selectedTimeSlot = timeSlot;

    // Enable booking button
    bookButton.disabled = false;
}

// Create a new booking
async function createBooking() {
    if (!currentUser.isLoggedIn) {
        showError(bookingError, 'Please login or register first');
        return;
    }

    const date = dateInput.value;
    const rangeType = rangeTypeInput.value;

    if (!date || !rangeType || !selectedTimeSlot) {
        showError(bookingError, 'Please select a date, range type, and time slot');
        return;
    }

    // Show loading state
    bookButton.disabled = true;
    bookButton.textContent = 'Processing...';
    bookingError.style.display = 'none';

    try {
        // Use password from memory
        if (!currentUser.password) {
            throw new Error('Session expired. Please login again');
        }

        // Create the booking
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: currentUser.name,
                email: currentUser.email,
                date: date,
                rangeType: rangeType,
                timeSlot: selectedTimeSlot,
                password: currentUser.password
            })
        });

        // Handle different response statuses
        if (response.status === 409) {
            throw new Error('This time slot is now fully booked. Please select another time.');
        }

        if (!response.ok) {
            if (response.status === 401) {
                handleLogout();
                throw new Error('Your session has expired. Please login again.');
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create booking');
        }

        // Booking successful
        alert('Booking confirmed successfully!');

        // Reset form but keep date and range type for convenience
        selectedTimeSlot = null;

        // Remove selected time slot highlighting
        document.querySelectorAll('.slot.selected').forEach(el => {
            el.classList.remove('selected');
        });

        bookButton.disabled = true;

        // Refresh time slots (some may no longer be available)
        checkAvailability();

        // Refresh bookings list
        loadBookings();

        // Switch to bookings tab
        tabs[1].click();
    } catch (error) {
        console.error('Error creating booking:', error);
        showError(bookingError, error.message || 'Failed to create booking');
    } finally {
        bookButton.disabled = false;
        bookButton.textContent = 'Book Range Time';
    }
}

// Cancel a booking
async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
        if (!currentUser.password || !currentUser.isLoggedIn) {
            handleLogout();
            throw new Error('Session expired. Please login again');
        }

        // Delete the booking
        const response = await fetch(`${API_URL}?id=${bookingId}&email=${encodeURIComponent(currentUser.email)}&password=${encodeURIComponent(currentUser.password)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            if (response.status === 401) {
                handleLogout();
                throw new Error('Session expired. Please login again');
            }

            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to cancel booking');
        }

        // Success
        alert('Booking cancelled successfully');

        // Refresh bookings (await the async call)
        await loadBookings();

        // If viewing the same date/range as canceled booking, refresh availability
        if (dateInput.value && rangeTypeInput.value) {
            await checkAvailability();
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert(error.message || 'Failed to cancel booking');
    }
}

// Helper function: Show error message
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

// Helper function: Format time slot
function formatTimeSlot(timeSlot) {
    if (!timeSlot) return '';

    const [start, end] = timeSlot.split('-');

    // Convert 24h to 12h format
    const formatHour = (hour) => {
        const [h, m] = hour.split(':');
        const hour12 = h % 12 || 12;
        const ampm = h < 12 ? 'AM' : 'PM';
        return `${hour12}:${m} ${ampm}`;
    };

    return `${formatHour(start)} - ${formatHour(end)}`;
}