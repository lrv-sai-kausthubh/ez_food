/**
 * User Profile Management System
 * 
 * This script handles all functionality for user profile management including:
 * - Form data saving/loading using localStorage
 * - Profile image upload and management
 * - Password visibility toggling
 * - Account overview tab data synchronization
 * - Save notifications (toast messages)
 */

// ===================================================
// CONSTANTS
// ===================================================
const STORAGE_KEYS = {
    PROFILE_DATA: 'userProfileData',
    PROFILE_IMAGE: 'userProfileImage'
};

const DEFAULT_PROFILE_IMAGE = "https://bootdey.com/img/Content/avatar/avatar1.png";

// ===================================================
// INITIALIZATION
// ===================================================


// Wait for the DOM to be fully loaded, then initialize the app
document.addEventListener('DOMContentLoaded', initializeApp);


/**
 * Main initialization function - runs when DOM is loaded
 * Sets up all event listeners and initializes functionality
 */
function initializeApp() {
    // Set up password visibility toggles
    setupPasswordToggles();
    
    // Add missing IDs to form elements
    addMissingIds();
    
    // Load saved data from localStorage
    loadFromLocalStorage();
    
    // Setup form save functionality
    setupFormSaving();
    
    // Setup profile image handling
    setupProfileImageHandling();
    
    // Set up toast notification
    setupSaveFeedback();
    
    // Initial update of overview tab
    updateAccountOverview();
    
    // Set up listeners for tab changes
    setupTabChangeListeners();
}

/**
 * Set up listeners for tab changes
 * Updates the overview tab when it becomes active
 */
function setupTabChangeListeners() {
    const tabs = document.querySelectorAll('.account-settings-links a[data-toggle="list"]');
    tabs.forEach(tab => {
        tab.addEventListener('click', function(event) {
            // If it's the overview tab, update the data
            if (this.getAttribute('href') === '#account-overview') {
                updateAccountOverview();
            }
        });
    });
}

// ===================================================
// PASSWORD MANAGEMENT
// ===================================================

/**
 * Set up password visibility toggle buttons
 * Adds click listeners to all password toggle elements
 */
function setupPasswordToggles() {
    // Get all password toggle icons
    const toggles = document.querySelectorAll('.toggle-password');
    
    // Add click event listener to each toggle
    toggles.forEach(function(toggle) {
        toggle.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            togglePasswordVisibility(targetId, this);
        });
    });
}

/**
 * Toggle password field visibility between text and password
 * @param {string} inputId - ID of the password input field
 * @param {Element} iconElement - The icon element that was clicked
 */
function togglePasswordVisibility(inputId, iconElement) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;

    // Toggle between password and text type
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        iconElement.classList.remove("fa-eye-slash");
        iconElement.classList.add("fa-eye");
    } else {
        passwordInput.type = "password";
        iconElement.classList.remove("fa-eye");
        iconElement.classList.add("fa-eye-slash");
    }
}

// ===================================================
// FORM DATA MANAGEMENT
// ===================================================

/**
 * Add IDs to form elements that don't have them
 * This ensures all relevant form fields can be saved properly
 */
function addMissingIds() {
    // Form fields to add IDs to if missing
    const formFields = [
        { selector: 'input[placeholder="Human"]', id: 'user-name' },
        { selector: 'input[placeholder="A0***/B0***"]', id: 'id-number' },
        { selector: 'input[placeholder="nmaxwell@mail.com"]', id: 'email' },
        { selector: 'input[placeholder="Company / Institute"]', id: 'company' },
        { selector: 'input[placeholder="+91 1234567890"]', id: 'phone-number' },
        { selector: 'input[placeholder="123456"]', id: 'otp' },
        { selector: 'textarea[placeholder="hello i am human"]', id: 'bio' },
        { selector: 'input[placeholder="May 3, 1995"]', id: 'birthday' },
        { selector: 'input[placeholder="Enter your country"]', id: 'country' }
    ];
    
    // Add IDs to elements that don't have them
    formFields.forEach(field => {
        const element = document.querySelector(field.selector);
        if (element && !element.id) {
            element.id = field.id;
        }
    });
}

/**
 * Save form data to localStorage
 * Collects all form input values and stores as JSON
 */
function saveToLocalStorage() {
    const userData = {};
    
    // Get all form inputs with IDs (except password and file inputs)
    const formElements = document.querySelectorAll('input[id]:not([type="file"]):not([type="password"]), textarea[id], select[id]');
    
    formElements.forEach(element => {
        userData[element.id] = element.value;
    });
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.PROFILE_DATA, JSON.stringify(userData));
}

/**
 * Load saved data from localStorage
 * Populates form fields with previously saved values
 */
function loadFromLocalStorage() {
    const savedData = localStorage.getItem(STORAGE_KEYS.PROFILE_DATA);
    
    if (savedData) {
        const userData = JSON.parse(savedData);
        
        // Populate form fields with saved data
        for (const [key, value] of Object.entries(userData)) {
            const element = document.getElementById(key);
            if (element) {
                element.value = value;
                
                // Fire change event for select2 to update
                if (element.tagName === 'SELECT') {
                    const event = new Event('change');
                    element.dispatchEvent(event);
                }
            }
        }
    }
}

/**
 * Setup form saving functionality
 * Adds event listeners to form elements and save button
 */
function setupFormSaving() {
    // Get all form inputs, textareas and selects
    const formElements = document.querySelectorAll('input:not([type="file"]):not([type="password"]), textarea, select');
    
    // Add change listeners to each element
    formElements.forEach(element => {
        element.addEventListener('change', saveToLocalStorage);
        element.addEventListener('input', saveToLocalStorage);
    });
    
    // Add click listener to save button
    const saveButton = document.querySelector('button.btn-primary');
    if (saveButton) {
        saveButton.addEventListener('click', function(event) {
            event.preventDefault();
            saveToLocalStorage();
            updateAccountOverview();
            showSaveMessage();
            
            // Submit the form programmatically after showing message
            setTimeout(() => {
                this.closest('form').submit();
            }, 500);
        });
    }
}

// ===================================================
// PROFILE IMAGE HANDLING
// ===================================================

/**
 * Set up profile image upload and display functionality
 * Handles file input change events and deletion of profile image
 */
function setupProfileImageHandling() {
    const profileImageUpload = document.getElementById('profile-image-upload');
    const profileImage = document.getElementById('profile-image');
    const removePhotoButton = document.getElementById('remove-profile-image');
    
    // Load profile image if it exists in localStorage
    const savedProfileImage = localStorage.getItem(STORAGE_KEYS.PROFILE_IMAGE);
    if (savedProfileImage && profileImage) {
        profileImage.src = savedProfileImage;
        
        // Also update the overview image if it exists
        updateOverviewImage(savedProfileImage);
    }
    
    // Handle image upload
    if (profileImageUpload) {
        profileImageUpload.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageData = e.target.result;
                    
                    // Update profile image
                    if (profileImage) {
                        profileImage.src = imageData;
                    }
                    
                    // Update overview image
                    updateOverviewImage(imageData);
                    
                    // Save to localStorage
                    localStorage.setItem(STORAGE_KEYS.PROFILE_IMAGE, imageData);
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Handle image removal
    if (removePhotoButton) {
        removePhotoButton.addEventListener('click', function() {
            // Reset to default image
            if (profileImage) {
                profileImage.src = DEFAULT_PROFILE_IMAGE;
            }
            
            // Update overview image
            updateOverviewImage(DEFAULT_PROFILE_IMAGE);
            
            // Remove from localStorage
            localStorage.removeItem(STORAGE_KEYS.PROFILE_IMAGE);
        });
    }
}

/**
 * Update profile image in the overview tab
 * @param {string} imageSrc - Source URL or data URL for the image
 */
function updateOverviewImage(imageSrc) {
    const overviewImage = document.querySelector('#account-overview img');
    if (overviewImage) {
        overviewImage.src = imageSrc;
    }
}

// ===================================================
// ACCOUNT OVERVIEW FUNCTIONALITY
// ===================================================

/**
 * Update the Account Overview tab with data from localStorage
 * Refreshes all overview fields with current user data
 */
function updateAccountOverview() {
    const savedData = localStorage.getItem(STORAGE_KEYS.PROFILE_DATA);
    
    if (savedData) {
        const userData = JSON.parse(savedData);
        
        // Update overview sections with user data
        const overviewFields = {
            'overview-name': 'user-name',
            'overview-company': 'company',
            'overview-id': 'id-number',
            'overview-email': 'email',
            'overview-phone': 'phone-number',
            'overview-birthday': 'birthday',
            'overview-country': 'country',
            'overview-bio': 'bio'
        };
        
        // Update each overview field
        Object.entries(overviewFields).forEach(([overviewId, dataId]) => {
            const element = document.getElementById(overviewId);
            if (element) {
                element.textContent = userData[dataId] || 'Not provided';
            }
        });
    }
    
    // Also update profile image in overview
    const savedProfileImage = localStorage.getItem(STORAGE_KEYS.PROFILE_IMAGE);
    if (savedProfileImage) {
        updateOverviewImage(savedProfileImage);
    }
}

// ===================================================
// UI COMPONENTS
// ===================================================

/**
 * Initialize Select2 dropdown for country selection
 * Enhances the country dropdown with search and better UI
 */
function initializeCountrySelect() {
    // Check if jQuery and Select2 are available
    if (typeof $ !== 'undefined' && $.fn.select2) {
        $('.country-select').select2({
            placeholder: "Select a country",
            allowClear: true
        });
    } else {
        console.warn("Select2 or jQuery not loaded. Country dropdown will use default styling.");
    }
}

// ===================================================
// TOAST NOTIFICATIONS
// ===================================================

/**
 * Setup toast notification for save feedback
 * Creates the HTML element for displaying save confirmation
 */
function setupSaveFeedback() {
    // Create feedback element if it doesn't exist
    if (!document.getElementById('save-feedback')) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'save-feedback';
        feedbackDiv.className = 'alert alert-success';
        feedbackDiv.style.position = 'fixed';
        feedbackDiv.style.bottom = '20px';
        feedbackDiv.style.right = '20px';
        feedbackDiv.style.padding = '15px 25px';
        feedbackDiv.style.borderRadius = '8px';
        feedbackDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        feedbackDiv.style.display = 'none';
        feedbackDiv.style.zIndex = '1050';
        feedbackDiv.style.transition = 'opacity 0.3s ease-in-out';
        feedbackDiv.style.opacity = '0';
        
        // Add an icon for better visibility
        feedbackDiv.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Profile data saved successfully!';
        document.body.appendChild(feedbackDiv);
    }
}

/**
 * Show save message with animation
 * Displays a toast notification with fade-in/fade-out effect
 */
function showSaveMessage() {
    const feedbackDiv = document.getElementById('save-feedback');
    if (feedbackDiv) {
        // Reset any existing animation
        clearTimeout(feedbackDiv.fadeTimeout);
        
        // Show the toast
        feedbackDiv.style.display = 'block';
        
        // Trigger reflow to enable animation
        feedbackDiv.offsetHeight;
        
        // Fade in
        feedbackDiv.style.opacity = '1';
        
        // Hide after 3 seconds with fade out
        feedbackDiv.fadeTimeout = setTimeout(() => {
            feedbackDiv.style.opacity = '0';
            setTimeout(() => {
                feedbackDiv.style.display = 'none';
            }, 300);
        }, 3000);
    }
}

