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