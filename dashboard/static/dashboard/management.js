/**
 * Cafeteria Management System
 * This script handles inventory management functionality including:
 * - CRUD operations for inventory items
 * - Category filtering and search
 * - Responsive UI updates
 * 
 * @version 1.2.0
 */

// =========================================================
// CONSTANTS & STATE
// =========================================================
const DEBUG_MODE = true;
const STOCK_LEVELS = {
  IN_STOCK: { min: 11, text: "In Stock", class: "in-stock" },
  LOW_STOCK: { min: 1, text: "Low Stock", class: "low-stock" },
  OUT_OF_STOCK: { min: 0, text: "Out of Stock", class: "out-of-stock" }
};

// Application state
let items = [];
let filteredCategory = "All";
let searchQuery = "";
let isUpdating = false; // Prevents multiple simultaneous updates

// =========================================================
// DOM ELEMENTS & UTILITIES
// =========================================================
/**
 * Get DOM element with error handling
 */
function getElement(id, errorMessage) {
  const element = document.getElementById(id);
  if (!element && DEBUG_MODE) {
    console.error(`Error: Element with ID '${id}' not found. ${errorMessage || ''}`);
  }
  return element;
}

// Core DOM elements
const inventoryTable = getElement("inventoryTable", "Table cannot be rendered");
const itemModal = getElement("itemModal", "Modal cannot be displayed");
const itemForm = getElement("itemForm", "Form submissions won't work");
const addItemBtn = getElement("addItemBtn", "Cannot add new items");
const closeModal = getElement("closeModal", "Cannot close modal");
const categoryNav = getElement("categoryNav", "Category filtering disabled");
const searchInput = getElement("searchInput", "Search functionality disabled");
const clearSearch = getElement("clearSearch", "Cannot clear search");

/**
 * Debug logging with type support
 */
function debugLog(message, data, type = 'log') {
  if (!DEBUG_MODE) return;
  
  const logFn = console[type] || console.log;
  const prefix = `[DEBUG] ${message}`;
  
  data !== undefined ? logFn(prefix, data) : logFn(prefix);
}

/**
 * Get CSRF token from cookie or form
 */
function getCsrfToken() {
  // Try cookie first
  try {
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
      
    if (token) {
      debugLog('CSRF token found in cookie');
      return token;
    }
  } catch (e) {
    debugLog('Error extracting CSRF token from cookie', e, 'error');
  }
  
  // Try input field
  const tokenInput = document.querySelector('[name=csrfmiddlewaretoken]');
  if (tokenInput?.value) {
    debugLog('CSRF token found in form field');
    return tokenInput.value;
  }
  
  debugLog('No CSRF token found!', null, 'warn');
  return null;
}

/**
 * Find item by ID helper
 */
function findItemById(id) {
  return items.find(item => item.id === id);
}

/**
 * Check if item name already exists (case insensitive)
 */
function isItemNameDuplicate(name) {
  if (!name) return false;
  
  const normalizedName = name.toLowerCase().trim();
  return items.some(item => item.name.toLowerCase().trim() === normalizedName);
}

// =========================================================
// INITIALIZATION
// =========================================================
/**
 * Initialize the application
 */
window.onload = () => {
  debugLog('Application initializing...', null, 'info');
  
  if (!inventoryTable || !itemForm) {
    console.error('Critical elements missing. Application cannot initialize.');
    return;
  }
  
  // Setup all required functionality
  fetchItems();
  setupEventListeners();
  
  debugLog('Application initialized', null, 'info');
};

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Modal controls
  if (addItemBtn) {
    addItemBtn.onclick = () => {
      debugLog('Opening add item modal');
      itemModal.style.display = "flex";
    };
  }

  if (closeModal) {
    closeModal.onclick = () => {
      debugLog('Closing modal');
      itemModal.style.display = "none";
    };
  }

  // Form submission
  if (itemForm) {
    itemForm.onsubmit = handleFormSubmit;
  }
  
  // Category filtering
  if (categoryNav) {
    categoryNav.addEventListener("click", handleCategoryFilter);
  }
  
  // Search functionality
  setupSearchFunctionality();
  
  // Table button events using delegation (prevents multiple listeners)
  setupTableEventListeners();
}

/**
 * Set up table event delegation
 */
function setupTableEventListeners() {
  if (!inventoryTable) return;
  
  // Remove any existing listener to avoid duplicates
  inventoryTable.removeEventListener('click', handleTableButtonClick);
  
  // Add single event listener to handle all button clicks
  inventoryTable.addEventListener('click', handleTableButtonClick);
}

/**
 * Set up search functionality
 */
function setupSearchFunctionality() {
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase();
      debugLog(`Search query updated: "${searchQuery}"`);
      renderTable();
    });
  }
  
  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      searchQuery = "";
      debugLog('Search cleared');
      renderTable();
    });
  }
}

// =========================================================
// EVENT HANDLERS
// =========================================================
/**
 * Handle table button clicks with event delegation
 */
function handleTableButtonClick(event) {
  const target = event.target;
  if (!target.classList.contains('qty-btn') && 
      !target.classList.contains('delete-btn')) {
    return; // Only handle button clicks
  }
  
  const id = parseInt(target.getAttribute('data-id'));
  if (!id) return;
  
  const item = findItemById(id);
  if (!item) {
    debugLog(`Item with ID ${id} not found`, null, 'error');
    return;
  }
  
  // Handle different button types
  if (target.classList.contains('increment-btn')) {
    updateQuantity(id, item.quantity + 1);
  } else if (target.classList.contains('decrement-btn') && item.quantity > 0) {
    updateQuantity(id, item.quantity - 1);
  } else if (target.classList.contains('delete-btn')) {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteItem(id);
    }
  }
}

/**
 * Handle category filter clicks
 */
function handleCategoryFilter(e) {
  const selected = e.target.getAttribute("data-category");
  if (selected) {
    debugLog(`Filtering by category: ${selected}`);
    filteredCategory = selected;
    renderTable();
  }
}

/**
 * Handle form submission
 */
function handleFormSubmit(e) {
  e.preventDefault();
  debugLog('Form submitted, validating fields...');
  
  // Get form field values
  const name = document.getElementById("itemName")?.value?.trim();
  const quantity = parseInt(document.getElementById("itemQty")?.value);
  const category = document.getElementById("itemCategory")?.value;
  
  debugLog('Form values:', { name, quantity, category });

  // Validate form fields
  const validationErrors = [];
  if (!name) validationErrors.push("Item name is required");
  if (isNaN(quantity)) validationErrors.push("Quantity must be a valid number");
  if (!category) validationErrors.push("Category is required");
  
  // Check for duplicate item name
  if (name && isItemNameDuplicate(name)) {
    validationErrors.push(`"${name}" already exists in inventory. Item names must be unique.`);
  }
  
  if (validationErrors.length > 0) {
    const errorMessage = "Please correct the following errors:\n" + validationErrors.join("\n");
    alert(errorMessage);
    debugLog('Form validation failed', validationErrors, 'error');
    return;
  }
  
  debugLog('Form validation passed, adding item...');
  addItem(name, quantity, category);
  itemModal.style.display = "none";
  itemForm.reset();
}

/**
 * Handle quantity value click to enable direct editing
 */
function handleQuantityValueClick(event) {
  if (!event.target.classList.contains('qty-value')) return;
  
  const span = event.target;
  const id = parseInt(span.getAttribute('data-id'));
  const currentValue = parseInt(span.textContent);
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.value = currentValue;
  input.className = 'qty-input';
  input.style.width = '40px';
  input.style.textAlign = 'center';
  
  // Replace span with input
  span.parentNode.replaceChild(input, span);
  input.focus();
  input.select();
  
  // Save data-id for later use
  input.setAttribute('data-id', id);
  
  // Handle input blur (when focus is lost)
  input.addEventListener('blur', handleQuantityInputComplete);
  
  // Handle Enter key press
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
}

// Add this to your existing initialization code, along with your other event listeners
inventoryTable.addEventListener('click', handleQuantityValueClick);

/**
 * Handle quantity input completion
 */
function handleQuantityInputComplete(event) {
  const input = event.target;
  const id = parseInt(input.getAttribute('data-id'));
  let newValue = parseInt(input.value);
  
  // Validate input
  if (isNaN(newValue) || newValue < 0) {
    newValue = 0;
  }
  
  // Create span element to replace input
  const span = document.createElement('span');
  span.textContent = newValue;
  span.className = 'qty-value';
  span.setAttribute('data-id', id);
  
  // Replace input with span
  input.parentNode.replaceChild(span, input);
  
  // Update quantity if changed
  const item = findItemById(id);
  if (item && item.quantity !== newValue) {
    updateQuantity(id, newValue);
  }
}

// =========================================================
// API COMMUNICATION
// =========================================================
/**
 * Fetch items from the server
 */
async function fetchItems() {
  debugLog('Fetching items from server...');
  try {
    const response = await fetch('/dashboard/api/items/');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    debugLog('Items fetched successfully', data);
    items = data.items;
    renderTable();
  } catch (error) {
    console.error('Error fetching items:', error);
    alert(`Failed to load inventory items. ${error.message}`);
  }
}

/**
 * Add new item
 */
async function addItem(name, quantity, category) {
  debugLog('Adding new item:', { name, quantity, category});
  try {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      alert("Security token missing. Please refresh the page.");
      return;
    }
    
    const payload = { 
      name, 
      quantity: parseInt(quantity), 
      category
    };
    
    const response = await fetch('/dashboard/api/items/add/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });
    
    // Check response type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    debugLog('Server response:', data);
    
    if (data.success) {
      // Add new item to local array
      items.push({
        id: data.id,
        name,
        quantity,
        category
      });
      renderTable();
      alert("Item added successfully!");
    } else {
      alert("Failed to add item: " + (data.message || data.error || "Unknown error"));
    }
  } catch (error) {
    console.error('Error adding item:', error);
    alert(error.message);
  }
}

/**
 * Delete item
 */
async function deleteItem(id) {
  debugLog(`Deleting item with ID: ${id}`);
  try {
    const csrfToken = getCsrfToken();
    
    const response = await fetch(`/dashboard/api/items/${id}/delete/`, {
      method: 'DELETE',
      headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
      credentials: 'same-origin'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      items = items.filter(item => item.id !== id);
      renderTable();
      debugLog(`Item ${id} deleted successfully`);
    } else {
      alert(`Failed to delete item: ${data.message || "Unknown error"}`);
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    alert(`Error deleting item: ${error.message}`);
  }
}

/**
 * Update item quantity with debouncing
 */
async function updateQuantity(id, newQuantity) {
  // Prevent duplicate calls during processing
  if (isUpdating) {
    debugLog('Update in progress, request ignored');
    return;
  }
  
  isUpdating = true;
  debugLog(`Updating item ${id} quantity to ${newQuantity}`);
  
  try {
    const item = findItemById(id);
    if (!item) {
      throw new Error(`Item with ID ${id} not found`);
    }
    
    const csrfToken = getCsrfToken();
    
    const response = await fetch(`/dashboard/api/items/${id}/update/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {})
      },
      body: JSON.stringify({ ...item, quantity: newQuantity }),
      credentials: 'same-origin'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      item.quantity = newQuantity;
      renderTable();
      debugLog(`Item ${id} quantity updated to ${newQuantity}`);
    } else {
      alert(`Failed to update quantity: ${data.message || "Unknown error"}`);
    }
  } catch (error) {
    console.error('Error updating item:', error);
    alert(`Error updating quantity: ${error.message}`);
  } finally {
    // Reset update flag after a delay to prevent rapid clicks
    setTimeout(() => {
      isUpdating = false;
    }, 300);
  }
}

// =========================================================
// UI RENDERING
// =========================================================
/**
 * Render inventory table
 */
function renderTable() {
  if (!inventoryTable) {
    console.error('Cannot render table: inventoryTable element not found');
    return;
  }
  
  debugLog('Rendering table with filters:', { 
    category: filteredCategory, 
    searchQuery: searchQuery,
    totalItems: items.length 
  });
  
  // Clear table
  inventoryTable.innerHTML = "";
  
  // Get filtered & sorted items
  const filteredItems = filterItems();
  sortItemsByStockStatus(filteredItems);

  // Handle empty state
  if (filteredItems.length === 0) {
    renderNoItemsMessage();
    return;
  }

  // Render items
  renderTableRows(filteredItems);
  
  debugLog('Table rendering complete');
}

/**
 * Filter items by category and search query
 */
function filterItems() {
  return items.filter((item) => {
    // Category filter
    const categoryMatch = filteredCategory === "All" || item.category === filteredCategory;
    
    // Search filter (case insensitive)
    const searchMatch = 
      item.name.toLowerCase().includes(searchQuery) ||
      item.category.toLowerCase().includes(searchQuery);
      
    return categoryMatch && searchMatch;
  });
}

/**
 * Sort items by stock status
 */
function sortItemsByStockStatus(items) {
  items.sort((a, b) => {
    // Get stock status priority
    const getPriority = (qty) => {
      if (qty > 10) return 1;      // In Stock
      if (qty > 0) return 2;       // Low Stock
      return 3;                    // Out of Stock
    };
    
    const priorityA = getPriority(a.quantity);
    const priorityB = getPriority(b.quantity);
    
    // Sort by status, then by quantity
    return (priorityA !== priorityB) 
      ? priorityA - priorityB 
      : a.quantity - b.quantity;
  });
}

/**
 * Render "no items" message
 */
function renderNoItemsMessage() {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td colspan="5" class="no-items">
      ${items.length === 0 ? "No items in inventory. Add some!" : "No matching items found."}
    </td>
  `;
  inventoryTable.appendChild(row);
}

/**
 * Render table rows
 */
function renderTableRows(filteredItems) {
  filteredItems.forEach((item) => {
    const row = document.createElement("tr");
    const stockStatus = getStockStatus(item.quantity);
    
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>
        <div class="quantity-control">
          <button class="qty-btn decrement-btn" data-id="${item.id}">${item.quantity > 0 ? "-" : "×"}</button>
          <span class="qty-value" data-id="${item.id}">${item.quantity}</span>
          <button class="qty-btn increment-btn" data-id="${item.id}">+</button>
        </div>
      </td>
      <td><span class="status ${stockStatus.class}">${stockStatus.text}</span></td>
      <td>
        <button class="delete-btn" data-id="${item.id}">Delete</button>
      </td>
    `;
    
    inventoryTable.appendChild(row);
  });
}

/**
 * Get stock status for quantity
 */
function getStockStatus(quantity) {
  if (quantity > 10) return STOCK_LEVELS.IN_STOCK;
  if (quantity > 0) return STOCK_LEVELS.LOW_STOCK;
  return STOCK_LEVELS.OUT_OF_STOCK;
}