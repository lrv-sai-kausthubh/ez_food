/**
 * EZ FOOD - Cafe Management System
 * JavaScript for handling UI interactions, cart management, and order processing
 */

/********************************************
 * INITIALIZATION & CORE SETUP
 ********************************************/

// Initialize AOS animation library
AOS.init({
  duration: 800,
  delay: 400
});

// Add right after the AOS.init code
// console.log = (function(originalLog) {
//   return function(...args) {
//     if (args[0] === 'Order history from backend:' && args[1] && args[1].length > 0) {
//       console.group('Date Format Analysis');
//       console.log('Raw backend date format:', typeof args[1][0].date, args[1][0].date);
//       console.log('Converted to timestamp:', new Date(args[1][0].date).getTime());
//       console.log('Formatted with IST:', formatDate(new Date(args[1][0].date)));
//       console.groupEnd();
//     }
//     originalLog.apply(console, args);
//   };
// })(console.log);

// Global state variables
let cart = [];
let orderHistory = [];
let inventoryData = {}; // Add this line to store inventory data

/********************************************
 * DOM ELEMENT SELECTORS
 ********************************************/

// Header and navigation elements
const navbar = document.querySelector('.navbar');
const menuBtn = document.querySelector('#menu-btn');

// Check if we're returning from checkout
document.addEventListener("DOMContentLoaded", function() {
    // Add this near the beginning of your existing DOMContentLoaded handler
    
    // Check if we're returning from checkout by looking for a URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout_complete') === 'true') {
        // Refresh order history immediately
        loadOrderHistory();
        
        // Show success message
        alert("Your order has been placed successfully!");
        
        // Clear the URL parameter
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
});



/********************************************
 * INVENTORY MANAGEMENT
 ********************************************/

/**
 * Fetch current inventory levels from the dashboard API
 * @returns {Promise} Promise resolving when inventory is loaded
 */
function fetchInventoryData() {
  //console.log('Fetching inventory data from server...');
  
  //fetching data from the dashboard public API the stock qty
  return fetch('/dashboard/api/public-items/')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      //console.log('Inventory data loaded:', data);
      
      // Convert array to object with name as key for easy lookup
      inventoryData = {};
      data.items.forEach(item => {
        // Store in lowercase for case-insensitive matching
        const normalizedName = item.name.toLowerCase().trim();
        inventoryData[normalizedName] = item;
        //console.log(`Loaded inventory item: "${normalizedName}" (${item.quantity} available)`);
      });
      
      // Update UI to reflect inventory status
      updateProductAvailability();
      return data;
    })
    .catch(error => {
      //console.error('Error fetching inventory:', error);
      return Promise.reject(error);
    });
}





// Add after the functions you just added

/**
 * Update all product cards to show inventory status
 */
function updateProductAvailability() {
  //console.log('Updating product availability display...');
  document.querySelectorAll('.box').forEach(box => {
    const nameElem = box.querySelector('h3');
    if (!nameElem) return;
    
    // Get clean item name (without icons)
    const displayName = nameElem.textContent;
    const cleanName = displayName
      .replace(/<[^>]*>/g, '')
      .replace(/\s*[^\w\s]\s*\w+\s*$/, '')
      .trim();
      
    //console.log(`Checking availability for "${cleanName}"`);
    const inventoryItem = getInventoryItemByName(cleanName);
    
    if (!inventoryItem) {
      console.warn(`⚠️ Inventory item not found for product: "${cleanName}"`);
      return; // Item not found in inventory
    }
    
    //console.log(`Found inventory for "${cleanName}": ${inventoryItem.quantity} available`);
    updateSingleProductAvailability(box, inventoryItem);
  });
}

/**
 * Update a single product card with inventory status
 */
function updateSingleProductAvailability(box, inventoryItem) {
  const addToCartBtn = box.querySelector('.add-to-cart');
  const quantityControls = box.querySelector('.cart-item-controls');
  
  if (!addToCartBtn) return;
  
  // Create or get status badge
  let statusBadge = box.querySelector('.inventory-status');
  if (!statusBadge) {
    statusBadge = document.createElement('div');
    statusBadge.className = 'inventory-status';
    box.querySelector('.content').prepend(statusBadge);
  }
  
  // Update status based on quantity
  if (inventoryItem.quantity <= 0) {
    // Out of stock
    statusBadge.textContent = 'Out of Stock';
    statusBadge.className = 'inventory-status out-of-stock';
    addToCartBtn.disabled = true;
    addToCartBtn.classList.add('disabled');
  } else {
    // In stock
    // Always show how many left
    statusBadge.textContent = `Only ${inventoryItem.quantity} left`;
    statusBadge.className = 'inventory-status low-stock';
    addToCartBtn.disabled = false;
    addToCartBtn.classList.remove('disabled');
  }
  
  // If item is in cart, update quantity controls
  if (quantityControls && quantityControls.style.display === 'flex') {
    const existingCartItem = cart.find(item => 
      item.name.toLowerCase().includes(inventoryItem.name.toLowerCase()) || 
      inventoryItem.name.toLowerCase().includes(item.name.toLowerCase())
    );
    
    if (existingCartItem) {
      const increaseBtn = quantityControls.querySelector('.quantity-increase');
      if (increaseBtn) {
        // Disable increase button if at inventory limit
        increaseBtn.disabled = existingCartItem.quantity >= inventoryItem.quantity;
        if (increaseBtn.disabled) {
          increaseBtn.classList.add('disabled');
        } else {
          increaseBtn.classList.remove('disabled');
        }
      }
    }
  }
}







/**
 * Find inventory item by product name (with improved matching)
 * @param {string} productName - Name of the product to find
 * @returns {Object|null} Inventory item or null if not found
 */
function getInventoryItemByName(productName) {
  if (!productName) return null;
  
  // Step 1: Better HTML cleaning and icon removal (FontAwesome icons)
  const cleanName = productName
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s*[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]+\s*\w+\s*$/, '') // Better symbol handling
    .toLowerCase()
    .trim();
  
  //console.log(`Looking for inventory item: "${cleanName}"`);
  
  // Step 2: Simple name normalization function for better matches
  const normalize = (name) => name.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normalizedName = normalize(cleanName);
  
  // Print full inventory for debugging
  //console.log("Available inventory items:", Object.keys(inventoryData).map(k => `"${k}" (${inventoryData[k].quantity})`).join(", "));
  
  // Step 3: Try direct match first (most reliable)
  if (inventoryData[cleanName]) {
    //console.log(`Found exact match for "${cleanName}"`);
    return inventoryData[cleanName];
  }
  
  // Step 4: Try normalized match 
  for (const key in inventoryData) {
    if (normalize(key) === normalizedName) {
      //console.log(`Found normalized match: "${cleanName}" ~ "${key}"`);
      return inventoryData[key];
    }
  }
  
  // Step 5: Try with just the first word (for common items like "Cake", "Sprite")
  const firstWord = cleanName.split(' ')[0];
  if (firstWord && firstWord.length > 2) { // Only try if first word is substantial
    for (const key in inventoryData) {
      if (key === firstWord || key.startsWith(firstWord)) {
        //console.log(`Found first-word match: "${cleanName}" ~ "${key}"`);
        return inventoryData[key];
      }
    }
  }
  
  // Step 6: Try substring matches as last resort
  for (const key in inventoryData) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      //console.log(`Found substring match: "${cleanName}" ~ "${key}"`);
      return inventoryData[key];
    }
  }
  
  //console.log(`❌ No inventory match found for "${cleanName}". Available items: ${Object.keys(inventoryData).join(', ')}`);
  return null;
}





// Cart elements
const cartSidebar = document.querySelector('.cart-sidebar');
const cartCount = document.querySelector('.cart-count');
const cartItemsContainer = document.querySelector('.cart-items');
const cartTotalElement = document.querySelector('.cart-total span');

// Order history elements
const orderHistoryContainer = document.querySelector('.order-history');

/********************************************
 * SLIDER/CAROUSEL FUNCTIONALITY
 ********************************************/

/**
 * Initialize a Swiper carousel with standard configuration
 * @param {string} sliderSelector - CSS selector for the swiper container
 * @returns {Object} Swiper instance
 */
const initSwiper = (sliderSelector) => {
  return new Swiper(sliderSelector, {
    loop: true,
    spaceBetween: 20,
    slidesPerView: 1,
    pagination: {
      el: `${sliderSelector} .swiper-pagination`,
      clickable: true,
    },
    navigation: {
      nextEl: `${sliderSelector} .swiper-button-next`,
      prevEl: `${sliderSelector} .swiper-button-prev`,
    },
    breakpoints: {
      640: { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      1024: { slidesPerView: 3 },
    },
  });
};

// Initialize all carousel instances
const snacksSwiper = initSwiper(".snacks-slider");
const drinksSwiper = initSwiper(".drinks-slider");
const dessertsSwiper = initSwiper(".desserts-slider");
const funFactsSwiper = initSwiper(".funfacts-slider");

/********************************************
 * HEADER & NAVIGATION FUNCTIONALITY
 ********************************************/

// Hamburger menu toggle
document.addEventListener("DOMContentLoaded", function () {
  if (!menuBtn || !navbar) return;

  menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    navbar.classList.toggle("active");
    menuBtn.classList.toggle("open");
  });

  document.addEventListener("click", function (e) {
    if (!menuBtn.contains(e.target) && !navbar.contains(e.target)) {
      navbar.classList.remove("active");
      menuBtn.classList.remove("open");
    }
  });
});

// Close menu on desktop view
window.addEventListener("resize", function () {
  if (window.innerWidth > 768) {
    navbar.classList.remove("active");
    menuBtn.classList.remove("open");
  }
});

// Close navigation and cart when scrolling
window.addEventListener('scroll', () => {
  navbar.classList.remove('active');
  cartSidebar.classList.remove('active');
});

/********************************************
 * LOCAL STORAGE FUNCTIONALITY
 ********************************************/

/**
 * Save cart data to localStorage
 */
function saveCartToStorage() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

/**
 * Save order history to localStorage
 */
function saveOrderHistoryToStorage() {
  localStorage.setItem('orderHistory', JSON.stringify(orderHistory));
}

/**
 * Load saved data from localStorage (cart and order history)
 */
function loadFromStorage() {
  // Load cart from localStorage
  if (localStorage.getItem('cart')) {
    cart = JSON.parse(localStorage.getItem('cart'));
    updateCart();
    initializeCartUI(); // Update UI based on cart state
  }
  
  // Load order history from localStorage
  if (localStorage.getItem('orderHistory')) {
    orderHistory = JSON.parse(localStorage.getItem('orderHistory'));
    updateOrderHistory();
  }
}

/********************************************
 * CART FUNCTIONALITY
 ********************************************/

/**
 * Add an item to the cart
 * @param {Event} e - Click event
 */
function addToCart(e) {
  const box = e.target.closest('.box');
  if (!box) return;

  // Don't proceed if button is disabled (out of stock)
  if (e.target.disabled || e.target.classList.contains('disabled')) {
    alert("Sorry, this item is out of stock.");
    return;
  }

  const nameElem = box.querySelector('h3');
  const priceElem = box.querySelector('.price');
  const imgElem = box.querySelector('img');

  const itemName = nameElem ? nameElem.textContent.trim() : 'Unknown Item';
  const priceMatch = priceElem ? priceElem.textContent.match(/\d+/) : null;
  const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
  const imageSrc = imgElem ? imgElem.src : '';

  // Check inventory before adding
  const inventoryItem = getInventoryItemByName(itemName);
  if (!inventoryItem || inventoryItem.quantity <= 0) {
    alert("Sorry, this item is out of stock.");
    return;
  }
  
  // Check if adding would exceed available quantity
  let existingItem = cart.find(cartItem => cartItem.name === itemName);
  if (existingItem) {
    if (existingItem.quantity >= inventoryItem.quantity) {
      alert(`Sorry, there are only ${inventoryItem.quantity} of this item available.`);
      return;
    }
    existingItem.quantity++;
  } else {
    // Create new cart item
    existingItem = { name: itemName, price, image: imageSrc, quantity: 1 };
    cart.push(existingItem);
  }

  updateCart();
  saveCartToStorage();

  // Update product card UI to show quantity controls
  updateProductCardControls(box, existingItem);
  
  // Show toast notification
  showToastNotification();
}

/**
 * Update UI controls on a product card after adding to cart
 * @param {HTMLElement} box - Product card element
 * @param {Object} existingItem - Cart item
 */
function updateProductCardControls(box, existingItem) {
  const addToCartBtn = box.querySelector('.add-to-cart');
  const quantityControls = box.querySelector('.cart-item-controls');

  if (!addToCartBtn || !quantityControls) return;

  // Hide "Add to Cart" button and show quantity controls
  addToCartBtn.style.display = 'none';
  quantityControls.style.display = 'flex';

  const quantityValue = quantityControls.querySelector('.quantity-value');
  quantityValue.textContent = existingItem.quantity;

  // Add event listeners for quantity controls
  setUpQuantityControls(box, quantityControls, existingItem);
}

/**
 * Set up event listeners for quantity controls on product cards
 * @param {HTMLElement} box - Product card element
 * @param {HTMLElement} quantityControls - Quantity controls container
 * @param {Object} item - Cart item
 */
function setUpQuantityControls(box, quantityControls, item) {
  const addToCartBtn = box.querySelector('.add-to-cart');
  const quantityValue = quantityControls.querySelector('.quantity-value');
  const inventoryItem = getInventoryItemByName(item.name);
  
  // Update increase button state based on inventory
  const increaseBtn = quantityControls.querySelector('.quantity-increase');
  if (inventoryItem && increaseBtn) {
    increaseBtn.disabled = item.quantity >= inventoryItem.quantity;
    if (increaseBtn.disabled) {
      increaseBtn.classList.add('disabled');
    } else {
      increaseBtn.classList.remove('disabled');
    }
  }
  
  // Decrease quantity
  quantityControls.querySelector('.quantity-decrease').addEventListener('click', () => {
    if (item.quantity > 1) {
      item.quantity--;
      quantityValue.textContent = item.quantity;
      
      // Re-enable increase button if below inventory quantity
      if (inventoryItem && increaseBtn) {
        increaseBtn.disabled = item.quantity >= inventoryItem.quantity;
        if (!increaseBtn.disabled) {
          increaseBtn.classList.remove('disabled');
        }
      }
    } else {
      cart = cart.filter(cartItem => cartItem.name !== item.name);
      addToCartBtn.style.display = 'inline-block';
      quantityControls.style.display = 'none';
    }
    updateCart();
    saveCartToStorage();
  });

  // Increase quantity
  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      // Check inventory before increasing
      if (inventoryItem && item.quantity >= inventoryItem.quantity) {
        alert(`Sorry, there are only ${inventoryItem.quantity} of this item available.`);
        return;
      }
      
      item.quantity++;
      quantityValue.textContent = item.quantity;
      
      // Disable increase button if at inventory limit
      if (inventoryItem && item.quantity >= inventoryItem.quantity) {
        increaseBtn.disabled = true;
        increaseBtn.classList.add('disabled');
      }
      
      updateCart();
      saveCartToStorage();
    });
  }

  // Remove item button functionality remains the same
  quantityControls.querySelector('.remove-item').addEventListener('click', () => {
    cart = cart.filter(cartItem => cartItem.name !== item.name);
    addToCartBtn.style.display = 'inline-block';
    quantityControls.style.display = 'none';
    updateCart();
    saveCartToStorage();
  });
}

/**
 * Display toast notification when item is added to cart
 */
function showToastNotification() {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 1500);
  }
}

/**
 * Update cart UI with current cart items and total
 */
function updateCart() {
  cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartItemsContainer.innerHTML = '';
  let total = 0;

  cart.forEach((item, index) => {
    const itemSubtotal = item.price * item.quantity;
    total += itemSubtotal;

    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p class="item-breakdown">₹${item.price} × ${item.quantity} = ₹${itemSubtotal.toFixed(2)}</p>
        <div class="cart-item-controls">
          <button class="quantity-decrease" data-index="${index}">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-increase" data-index="${index}">+</button>
        </div>
      </div>
      <button class="remove-item" data-index="${index}">&times;</button>
    `;
    cartItemsContainer.appendChild(cartItem);
  });

  cartTotalElement.textContent = total.toFixed(2);
  
  // Update product cards to match cart state
  initializeCartUI();
}

/**
 * Initialize/update product cards UI based on current cart state
 */
function initializeCartUI() {
  document.querySelectorAll('.box').forEach(box => {
    const nameElem = box.querySelector('h3');
    const addToCartBtn = box.querySelector('.add-to-cart');
    const quantityControls = box.querySelector('.cart-item-controls');
    
    if (!nameElem || !addToCartBtn || !quantityControls) return;

    const itemName = nameElem.textContent.trim();
    const existingItem = cart.find(cartItem => cartItem.name === itemName);
    const quantityValue = quantityControls.querySelector('.quantity-value');

    if (existingItem) {
      // If item is in cart, show quantity controls
      addToCartBtn.style.display = 'none';
      quantityControls.style.display = 'flex';
      if (quantityValue) quantityValue.textContent = existingItem.quantity;
    } else {
      // If item is not in cart, show "Add to Cart" button
      addToCartBtn.style.display = 'inline-block';
      quantityControls.style.display = 'none';
    }
  });
}

/********************************************
 * CHECKOUT & ORDER HISTORY FUNCTIONALITY
 ********************************************/

/**
 * Format date for order display in Indian Standard Time
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  // Create date formatter specifically for IST
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  return formatter.format(date);
}




/**
 * Generate a unique order ID
 * @returns {string} Order ID
 */
function generateOrderId() {
  return 'CMS-' + Math.floor(100000 + Math.random() * 900000);
}
// function generateOrderId() {
//   return 'lrv-cms-' + Math.floor(100000 + Math.random() * 900000);
// }

function getCSRFToken() {
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  
  //console.log("CSRF Token:", cookieValue); // Debug: Check if token is found
  return cookieValue;
}


/**
 * Process the checkout and create a new order
 */
function processCheckout() {
  if (cart.length === 0) return;

  //console.log('Processing checkout, checking inventory levels...');
  
  // First refresh inventory data to ensure we have the latest quantities
  fetchInventoryData()
    .then(() => {
      // Then verify all items are still in stock at the requested quantities
      const outOfStockItems = [];
      
      for (const item of cart) {
        const inventoryItem = getInventoryItemByName(item.name);
        //console.log(`Checking "${item.name}": requested=${item.quantity}, available=${inventoryItem?.quantity || 0}`);
        
        if (!inventoryItem || inventoryItem.quantity < item.quantity) {
          outOfStockItems.push(item.name);
        }
      }
      
      if (outOfStockItems.length > 0) {
        alert(`Sorry, the following items are no longer available in the requested quantity: ${outOfStockItems.join(', ')}\n\nPlease update your cart and try again.`);
        return;
      }
      
      // Continue with checkout process...
      const studentId = prompt("Enter your Student ID to confirm your order:");
      if (!studentId || studentId.trim() === "") {
        alert("Please Enter Your Student ID To Place An Order.");
        return;
      }
      
      const orderId = generateOrderId();
      
      // Prepare order data
      const orderData = {
        order_id: orderId,
        student_id: studentId.trim(),
        items: cart.map(item => ({
          name: item.name,
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity)
        }))
      };

      //console.log("Submitting order:", orderData);

      // Get CSRF token
      const csrfToken = getCSRFToken();
      if (!csrfToken) {
        console.error("CSRF token not found!");
        alert("Security token missing. Please refresh the page.");
        return;
      }

      // Process order on server
      fetch('/shop/api/save-order/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify(orderData)
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`Server returned ${response.status}: ${text}`);
          });
        }
        return response.json();
      })
      .then(data => {
        //console.log("Order submitted successfully:", data);
        
        // Update inventory quantities
        return updateInventoryAfterCheckout()
          .then(() => {
            // Add order to history with current date
            const newOrder = {
              orderId: orderId,
              studentId: studentId.trim(),
              date: new Date().getTime(),
              items: [...cart] // Create a copy of the cart items
            };
            
            // Add to order history
            orderHistory.unshift(newOrder); // Add to beginning
            saveOrderHistoryToStorage();
            
            // Clear cart
            cart = [];
            updateCart();
            saveCartToStorage();
            
            // Update UI
            alert(`Order placed successfully! Your Order ID is: ${orderId}`);
            cartSidebar.classList.remove('active');
            
            // Scroll to order history section
            document.getElementById('order-history')?.scrollIntoView({ behavior: 'smooth' });
            
            // Refresh order history display
            updateOrderHistory();
          });
      })
      .catch(error => {
        console.error('Error:', error);
        alert('There was a problem with your order. Please try again: ' + error.message);
      });
    })
    .catch(error => {
      console.error('Error during checkout:', error);
      alert('Unable to process checkout. Please try again.');
    });
}

/**
 * Update inventory quantities after checkout
 * @returns {Promise} Promise resolving when inventory is updated
 */
function updateInventoryAfterCheckout() {
  //console.log('Updating inventory after checkout...');
  
  const updatePromises = cart.map(item => {
    const inventoryItem = getInventoryItemByName(item.name);
    
    if (!inventoryItem) {
      console.warn(`⚠️ Cannot update inventory: No match found for "${item.name}"`);
      return Promise.resolve(); // Skip if not found
    }
    
    const newQuantity = Math.max(0, inventoryItem.quantity - item.quantity);
    //console.log(`Updating "${item.name}" (ID: ${inventoryItem.id}): ${inventoryItem.quantity} → ${newQuantity}`);
    
    return fetch(`/dashboard/api/items/${inventoryItem.id}/update/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken()
      },
      body: JSON.stringify({
        ...inventoryItem,
        quantity: newQuantity
      }),
      credentials: 'same-origin'
    })
    .then(response => {
      if (!response.ok) {
        console.error(`Failed to update inventory for ${item.name}: ${response.status}`);
        return response.text().then(text => {
          throw new Error(`Failed to update inventory: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      //console.log(`Successfully updated inventory for "${item.name}": ${data.quantity} remaining`);
      return data;
    });
  });
  
  return Promise.all(updatePromises)
    .then(() => {
      //console.log('All inventory updates completed');
      // Refresh inventory data after all updates
      return fetchInventoryData();
    });
}

/**
 * Update the order history display
 */
function updateOrderHistory() {
  orderHistoryContainer.innerHTML = '';

  // Add heading for order history section
  const heading = document.createElement('h1');
  heading.className = 'heading';
  heading.innerHTML = '<span>Your</span> Order History';
  orderHistoryContainer.appendChild(heading);

  if (orderHistory.length === 0) {
    orderHistoryContainer.innerHTML += `
      <div class="orders-container">
        <p class="empty-history-text">No previous orders found. Start adding delicious treats to your cart!</p>
      </div>
    `;
    return;
  }

  const orderList = document.createElement('div');
  orderList.className = 'order-list';

  // Only show the 3 most recent orders
  const recentOrders = orderHistory.slice(0, 3);

  recentOrders.forEach((order, index) => {
    let orderTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderDiv = document.createElement('div');
    orderDiv.className = 'order-history-item';

    orderDiv.innerHTML = `
      <div class="order-summary">
        <h4>Order ID: <span>${order.orderId}</span></h4>
        <h4>Student ID: <span>${order.studentId}</span></h4>
        <h4>Date: <span>${formatDate(new Date(order.date))}</span></h4>
        <h4>Total: ₹${orderTotal.toFixed(2)}</h4>
        <button class="toggle-details-btn" data-index="${index}">View Details ▼</button>
      </div>
      
      <div class="order-details" id="order-details-${index}">
        <ul>
          ${order.items.map(item => 
            `<li>🛒 ${item.name} × ${item.quantity} - ₹${(item.price * item.quantity).toFixed(2)}</li>`
          ).join('')}
        </ul>
      </div>
    `;

    orderList.appendChild(orderDiv);
  });

  // Add "View More" button if there are more than 3 orders
  if (orderHistory.length > 3) {
    const viewMoreDiv = document.createElement('div');
    viewMoreDiv.className = 'view-more-container';
    viewMoreDiv.innerHTML = `
      <a href="/shop/history/" class="btn view-more-btn">View All Orders</a>
    `;
    orderList.appendChild(viewMoreDiv);
  }

  orderHistoryContainer.appendChild(orderList);

  // Add event listeners to toggle details buttons
  document.querySelectorAll('.toggle-details-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const index = btn.dataset.index;
      const detailsDiv = document.getElementById(`order-details-${index}`);
      detailsDiv.classList.toggle('show-details');
      btn.innerHTML = detailsDiv.classList.contains('show-details') ? 'Hide Details ▲' : 'View Details ▼';
    });
  });
}

/********************************************
 * EVENT LISTENERS
 ********************************************/

// Initialize event listeners when DOM is fully loaded
document.addEventListener("DOMContentLoaded", function() {
  // Load cart from localstorage
  if (localStorage.getItem('cart')) {
    cart = JSON.parse(localStorage.getItem('cart'));
    updateCart();
    initializeCartUI();
  }

  // Fetch inventory data first, then load order history
  fetchInventoryData()
    .then(() => {
      // Load order history from backend (only once)
      loadOrderHistory();
      
      // Now that inventory data is loaded, set up cart buttons
      document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', addToCart);
      });
    })
    .catch(err => {
      console.error("Failed to load inventory data:", err);
      // Still load order history even if inventory fails
      loadOrderHistory();
    });  

  // Load order history from backend
  //loadOrderHistory();

  
  // Set up "Add to Cart" buttons
  document.querySelectorAll('.add-to-cart').forEach(button => {
    button.addEventListener('click', addToCart);
  });
  
  // Cart sidebar toggle
  document.querySelector('#cart-btn')?.addEventListener('click', () => {
    cartSidebar.classList.add('active');
    navbar.classList.remove('active');
  });
  
  document.querySelector('.close-cart')?.addEventListener('click', () => {
    cartSidebar.classList.remove('active');
  });
  
  // // Checkout button
  // document.querySelector('.checkout-btn')?.addEventListener('click', () => {
  //   if (cart.length === 0) return;
  //   if (confirm('Confirm checkout?')) {
  //     processCheckout();
  //   }
  // });

  // Checkout button
  document.querySelector('.checkout-btn')?.addEventListener('click', () => {
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    
    // Store cart data in localStorage before redirecting
    localStorage.setItem('checkoutCart', JSON.stringify(cart));
    
    // Redirect to the checkout page in managepayments app
    window.location.href = '/managepayments/checkout/';
  });


  // Cart item controls (event delegation)
  cartItemsContainer?.addEventListener('click', (e) => {
    const index = e.target.dataset.index;
    if (!index) return;

    if (e.target.classList.contains('remove-item')) {
      cart.splice(index, 1);
    } else if (e.target.classList.contains('quantity-increase')) {
      cart[index].quantity++;
    } else if (e.target.classList.contains('quantity-decrease')) {
      if (cart[index].quantity > 1) {
        cart[index].quantity--;
      } else {
        cart.splice(index, 1);
      }
    }
    
    updateCart();
    saveCartToStorage();
  });
  
  // Enable lazy loading for images
  document.querySelectorAll('img').forEach(img => img.setAttribute('loading', 'lazy'));
});


















/**
 * Load and display the user's name from localStorage
 */
function loadUserName() {
    const usernameDisplay = document.getElementById('header-username');
    
    // Check if the username display element exists
    if (usernameDisplay) {
        // Get profile data from localStorage using the same key as in profile.js
        const savedData = localStorage.getItem('userProfileData');
        
        if (savedData) {
            try {
                const userData = JSON.parse(savedData);
                // Display username if available, otherwise show a default
                if (userData['user-name']) {
                    usernameDisplay.textContent = userData['user-name'];
                } else {
                    usernameDisplay.textContent = 'Guest';
                }
            } catch (error) {
                console.error('Error parsing user data:', error);
                usernameDisplay.textContent = 'Guest';
            }
        } else {
            usernameDisplay.textContent = 'Guest';
        }
    }
}

// Add event listener for localStorage changes
window.addEventListener('storage', function(event) {
    // Only reload username if profile data was changed
    if (event.key === 'userProfileData') {
        loadUserName();
    }
});

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load the username when page loads
    loadUserName();
});




// part which displays username from profile.js 
/**
 * Load and display the user's name from localStorage
 */
function loadUserName() {
    const navUsername = document.getElementById('nav-username');
    const footerUsername = document.getElementById('header-username');
    
    // Get profile data from localStorage
    const savedData = localStorage.getItem('userProfileData');
    
    let displayName = 'Guest';
    
    if (savedData) {
        try {
            const userData = JSON.parse(savedData);
            // Display username if available
            if (userData['user-name']) {
                displayName = userData['user-name'];
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
    }
    
    // Update both username locations
    if (navUsername) {
        navUsername.textContent = displayName;
    }
    
    if (footerUsername) {
        footerUsername.textContent = displayName;
    }
}

// Make sure this runs when the page loads
document.addEventListener('DOMContentLoaded', loadUserName);

// Add event listener for localStorage changes
window.addEventListener('storage', function(event) {
    // Only reload username if profile data was changed
    if (event.key === 'userProfileData') {
        loadUserName();
    }
});




/**
 * Load order history from shop.models.Order database
 */
function loadOrderHistory() {
  //onsole.log('Loading order history from shop.models.Order database...');
  
  // First load from localStorage for immediate display
  if (localStorage.getItem('orderHistory')) {
    orderHistory = JSON.parse(localStorage.getItem('orderHistory'));
    updateOrderHistory(); // Show cached data immediately
  }
  
  // Then fetch from shop app's order endpoint
  fetch('/shop/api/get-order-history/')
    .then(response => {
      if (!response.ok) {
        console.warn(`Server returned ${response.status}: ${response.statusText}`);
        // Don't throw error, just continue using localStorage data
        return { orders: [] };  // Return empty data structure
      }
      return response.json();
    })
    .then(data => {
      //console.log('Order history from shop.models.Order:', data);
      
      // Check if data is valid and contains orders
      if (!data || !Array.isArray(data) || data.length === 0) {
        //console.log('No orders found in database, using localStorage data');
        return; // No server data, keep using localStorage
      }
      
      // Create a new order history array from database data
      const dbOrderHistory = data.map(serverOrder => {
        try {
          // Convert date format if needed
          const serverDate = typeof serverOrder.date === 'number' 
            ? serverOrder.date 
            : new Date(serverOrder.date).getTime();
          
          return {
            orderId: serverOrder.orderId,
            studentId: serverOrder.studentId,
            date: serverDate,
            items: serverOrder.items || []
          };
        } catch (err) {
          console.warn(`Error processing order: ${err}`);
          return null;
        }
      }).filter(order => order !== null);  // Remove any null entries
      
      if (dbOrderHistory.length > 0) {
        // Replace local order history with database data
        orderHistory = dbOrderHistory;
        
        // Sort by date (newest first)
        orderHistory.sort((a, b) => b.date - a.date);
        
        // Update localStorage with database data
        saveOrderHistoryToStorage();
        
        // Update the UI
        updateOrderHistory();
        //console.log(`Loaded ${orderHistory.length} orders from shop.models.Order database`);
      }
    })
    .catch(error => {
      console.error('Error fetching order history from database:', error);
      
      // If fetch fails but we have localStorage data, keep using it
      if (orderHistory.length > 0) {
        //console.log('Using cached order history from localStorage due to fetch error');
      }
    });
}

























// js for the nav bar text dropdown


// Add to cafe.js
document.addEventListener('DOMContentLoaded', function() {
    // Username dropdown functionality
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            dropdownMenu.classList.toggle('active');
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = dropdownMenu.classList.contains('active') 
                    ? 'rotate(180deg)' 
                    : 'rotate(0)';
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('active');
                const icon = dropdownToggle.querySelector('i');
                if (icon) icon.style.transform = 'rotate(0)';
            }
        });
    }
    
    // Copy username to mobile menu
    const navUsername = document.getElementById('nav-username');
    const mobileUsername = document.querySelector('.mobile-username');
    if (navUsername && mobileUsername && navUsername.textContent) {
        mobileUsername.textContent = navUsername.textContent;
    }
});

