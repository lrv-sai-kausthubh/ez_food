/************************************************
 * UTILITY FUNCTIONS
 ************************************************/


// Declare chart variables at the top of your file
let topItemsChart = null;
let leastItemsChart = null;


/**
 * Format date to IST timezone
 * @param {string|number} dateString - Date string or timestamp
 * @returns {string} - Formatted date string in IST
 */
function formatDateToIST(dateString) {
    // Handle both timestamp (number) and string inputs
    const date = typeof dateString === 'number' ? 
        new Date(dateString) : // It's already a timestamp
        new Date(dateString);  // Convert string to Date
        
    const options = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    return date.toLocaleString('en-IN', options);
}

// Store all transactions for filtering
let allTransactions = [];

/************************************************
 * INITIALIZATION
 ************************************************/

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up search event listeners
    document.getElementById('clearSearch').addEventListener('click', clearSearch);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);

    // Add export button logic
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        // Update export URL when date filter changes
        document.getElementById('dateFilter').addEventListener('change', function() {
            const filterValue = this.value;
            exportButton.href = `/transactions/api/export/?filter=${filterValue}`;
        });
    }
    
    // Set up date filtering event listeners
    if (document.getElementById('dateFilter')) {
        document.getElementById('dateFilter').addEventListener('change', handleDateFilterChange);
    }
    
    if (document.getElementById('applyCustomRange')) {
        document.getElementById('applyCustomRange').addEventListener('click', applyCustomDateRange);
    }

        // Add event listener for items count filter
    if (document.getElementById('itemsCountFilter')) {
        document.getElementById('itemsCountFilter').addEventListener('change', function() {
            // Re-apply the current date filter to update the display
            const currentFilter = document.getElementById('dateFilter').value;
            if (currentFilter === 'custom') {
                applyCustomDateRange();
            } else {
                applyDateFilter(currentFilter);
            }
        });
    }
    
    // Fetch transactions when the page loads
    fetchTransactions();
});

/************************************************
 * DATA FETCHING
 ************************************************/

/**
 * Display message when no item statistics are available
 */
function displayNoItemStats() {
    document.getElementById('topSoldItems').innerHTML = 
        '<li class="empty-message">No data available</li>';
    document.getElementById('leastSoldItems').innerHTML = 
        '<li class="empty-message">No data available</li>';
}


/**
 * Calculate item statistics from transaction data
 * @param {Array} transactions - Array of filtered transaction objects
 * @returns {Object} - Object with top_items and least_items arrays
 */
function calculateItemStats(transactions) {
    // Early return if no transactions
    if (!transactions || transactions.length === 0) {
        return {
            top_items: [],
            least_items: []
        };
    }
    
    // Get all items from the transactions
    let itemCounts = {};
    
    // Loop through each transaction
    transactions.forEach(transaction => {
        // Only process if the transaction has items
        if (transaction.items && transaction.items.length > 0) {
            transaction.items.forEach(item => {
                const itemName = item.name;
                if (itemCounts[itemName]) {
                    itemCounts[itemName] += item.quantity;
                } else {
                    itemCounts[itemName] = item.quantity;
                }
            });
        }
    });
    
    // Convert to array for sorting
    const itemsArray = Object.entries(itemCounts).map(([name, count]) => ({
        name: name,
        count: count
    }));
    
    // Get the user-selected number of items to display (default to 3)
    const itemsToShow = parseInt(document.getElementById('itemsCountFilter')?.value || 3);
    
    // Sort by count (descending for top items)
    itemsArray.sort((a, b) => b.count - a.count);
    
    // Get top N items, but only include items actually sold (no empty slots)
    const topItems = itemsArray.slice(0, Math.min(itemsToShow, itemsArray.length));
    
    // Reverse sort for least items (we want the least sold)
    const leastItemsArray = [...itemsArray].sort((a, b) => a.count - b.count);
    // Get bottom N items, but only include items actually sold (no empty slots)
    const leastItems = leastItemsArray.slice(0, Math.min(itemsToShow, leastItemsArray.length));
    
    return {
        top_items: topItems,
        least_items: leastItems
    };
}


/**
 * Update transaction statistics
 * @param {Array} transactions - Array of transaction objects
 */
function updateTransactionStatistics(transactions) {
    if (!transactions || transactions.length === 0) {
        document.getElementById('totalTransactions').textContent = "0";
        document.getElementById('totalRevenue').textContent = "₹0.00";
        document.getElementById('avgOrderValue').textContent = "₹0.00";
        document.getElementById('recentOrder').textContent = "None";
        return;
    }
    
    // Calculate total transactions
    const totalTransactions = transactions.length;
    document.getElementById('totalTransactions').textContent = totalTransactions;
    
    // Calculate total revenue
    const totalRevenue = transactions.reduce((sum, transaction) => sum + transaction.total, 0);
    document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toFixed(2)}`;
    
    // Calculate average order value
    const avgOrderValue = totalRevenue / totalTransactions;
    document.getElementById('avgOrderValue').textContent = `₹${avgOrderValue.toFixed(2)}`;
    
    // Sort transactions by date (newest first) to find most recent order
    const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    // Get most recent order from sorted array
    const recentOrder = sortedTransactions[0];
    document.getElementById('recentOrder').textContent = `${recentOrder.order_id} - ${formatDateToIST(recentOrder.date)}`;
}




/**
 * Fetch transactions from the server with always-fresh status data
 */
async function fetchTransactions() {
    try {
        // Always fetch fresh data by adding a cache-busting parameter
        const response = await fetch('/transactions/api/list/?fresh=' + new Date().getTime());
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Store all transactions for filtering
            allTransactions = data.transactions;
            
            // IMPORTANT: Clear ALL cached transaction data to prevent stale data
            localStorage.removeItem('transactionData');
            localStorage.removeItem('transactionTimestamp');
            localStorage.removeItem('transactionDetails'); // ADDED THIS LINE to clear cached details
            
            // Fetch detailed item data for each transaction
            await fetchTransactionDetails();
            
            // Render transactions and update statistics
            renderTransactionsTable(allTransactions);
            updateTransactionStatistics(allTransactions);
            const itemStats = calculateItemStats(allTransactions);
            updateItemStatistics(itemStats);
        } else {
            console.error('Error fetching transactions:', data.error);
            alert('Failed to load transactions. Please try again later.');
        }
    } catch (error) {
        console.error('Error fetching transactions:', error);
        alert(`Failed to load transactions: ${error.message}`);
    }
}




/**
 * Fetch detailed information for each transaction with caching
 */
async function fetchTransactionDetails() {
    try {
        // Get new transactions from last 30 minutes
        const thirtyMinutesAgo = new Date();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
        
        // Check if we have cached transaction details
        const cachedDetails = localStorage.getItem('transactionDetails');
        let detailsData = {};
        
        if (cachedDetails) {
            detailsData = JSON.parse(cachedDetails);
        }
        
        // Sort transactions: new ones first, then ones without cached details
        const recentTransactions = allTransactions.filter(tx => 
            new Date(tx.date) > thirtyMinutesAgo);
        
        const oldTransactions = allTransactions.filter(tx => 
            new Date(tx.date) <= thirtyMinutesAgo);
        
        // ALWAYS fetch details for recent transactions (last 30 minutes)
        if (recentTransactions.length > 0) {
            console.log(`Fetching fresh details for ${recentTransactions.length} recent transactions`);
            await fetchMissingDetails(recentTransactions, detailsData);
        }
        
        // For older transactions, use cache when available
        for (const transaction of oldTransactions) {
            if (detailsData[transaction.order_id]) {
                transaction.items = detailsData[transaction.order_id];
            }
        }
        
        // Fetch details for older transactions that don't have cached details
        const uncachedOldTransactions = oldTransactions.filter(tx => !tx.items);
        if (uncachedOldTransactions.length > 0) {
            console.log(`Fetching details for ${uncachedOldTransactions.length} uncached older transactions`);
            await fetchMissingDetails(uncachedOldTransactions, detailsData);
        }
    } catch (error) {
        console.error('Error in fetchTransactionDetails:', error);
    }
}

/**
 * Refresh all transaction data on page load/refresh
 */
window.addEventListener('pageshow', function(event) {
    // Check if the page is being loaded from cache (back/forward navigation)
    // or if it's a fresh load/refresh
    if (event.persisted || (window.performance && 
        window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD)) {
        console.log('Page refreshed - forcing data reload');
        
        // Clear all localStorage cache
        localStorage.removeItem('transactionData');
        localStorage.removeItem('transactionTimestamp');
        localStorage.removeItem('transactionDetails');
        
        // Fetch fresh transactions
        fetchTransactions();
    }
});



/**
 * Helper function to fetch only missing transaction details
 */
async function fetchMissingDetails(transactions, detailsCache) {
    for (const transaction of transactions) {
        try {
            const response = await fetch(`/transactions/api/details/${transaction.order_id}/`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.order) {
                    // Add items to transaction
                    transaction.items = data.order.items;
                    
                    // Add to cache
                    detailsCache[transaction.order_id] = data.order.items;
                }
            }
        } catch (error) {
            console.error(`Error fetching details for order ${transaction.order_id}:`, error);
        }
    }
    
    // Save updated cache
    localStorage.setItem('transactionDetails', JSON.stringify(detailsCache));
}














/************************************************
 * UI RENDERING FUNCTIONS
 ************************************************/

/**
 * Render transactions in the table
 * @param {Array} transactions - Array of transaction objects
 */
function renderTransactionsTable(transactions) {
    const tableBody = document.getElementById('transactionsTable');
    tableBody.innerHTML = '';
    
    if (transactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="no-data">No transactions found</td></tr>`;
        return;
    }
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.setAttribute('data-order-id', transaction.order_id);
        
        const formattedDate = formatDateToIST(transaction.date);
        const status = transaction.status || 'pending';
        const statusText = getStatusDisplayText(status);
        
        row.innerHTML = `
            <td>${transaction.order_id}</td>
            <td>${transaction.student_id}</td>
            <td>${formattedDate}</td>
            <td>₹${transaction.total.toFixed(2)}</td>
            <td>
                <button class="view-details-btn" data-id="${transaction.order_id}">View Details</button>
                <span class="order-status status-${status}">${statusText}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the view details buttons
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.getAttribute('data-id');
            viewOrderDetails(orderId);
        });
    });
}



/************************************************
 * ORDER DETAILS FUNCTIONS
 ************************************************/

/**
 * View order details
 * @param {string} orderId - Order ID to fetch details for
 */
async function viewOrderDetails(orderId) {
    try {
        const response = await fetch(`/transactions/api/details/${orderId}/`);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showDetailsModal(data.order);
        } else {
            console.error('Error fetching order details:', data.error);
            alert('Failed to load order details. Please try again later.');
        }
    } catch (error) {
        console.error('Error fetching order details:', error);
        alert(`Failed to load order details: ${error.message}`);
    }
}

/**
 * Show order details modal
 * @param {Object} order - Order object containing details
 */
function showDetailsModal(order) {
    const detailsDiv = document.getElementById('orderDetails');
    
    // Create table for items instead of plain text
    let itemsHtml = `
        <table class="items-table">
            <thead>
                <tr>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    order.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        itemsHtml += `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>₹${itemTotal.toFixed(2)}</td>
            </tr>
        `;
    });
    
    itemsHtml += `
            </tbody>
        </table>
    `;

    detailsDiv.innerHTML = `
        <div class="detail-row" data-order-id="${order.order_id}">
            <strong>Order ID:</strong> ${order.order_id}
        </div>
        <div class="detail-row">
            <strong>Student ID:</strong> ${order.student_id}
        </div>
        ${order.name ? `<div class="detail-row">
            <strong>Name:</strong> ${order.name}
        </div>` : ''}
        ${order.payment_method ? `<div class="detail-row">
            <strong>Payment Method:</strong> ${order.payment_method}
        </div>` : ''}
        <div class="detail-row">
            <strong>Status:</strong> <span class="status-badge status-${order.status || 'pending'}">${getStatusDisplayText(order.status || 'pending')}</span>
        </div>
        <div class="detail-row">
            <strong>Date:</strong> ${formatDateToIST(order.date)}
        </div>
        <div class="detail-row">
            <strong>Total:</strong> ₹${order.total.toFixed(2)}
        </div>
        <div class="items-list">
            <strong>Items:</strong>
            ${itemsHtml}
        </div>
    `;
    
    // Set the current status in the dropdown - with fallback to 'pending'
    const statusSelect = document.getElementById('orderStatusSelect');
    if (statusSelect) {
        const currentStatus = order.status || 'pending';
        
        // Check if the option exists before setting value
        const optionExists = Array.from(statusSelect.options).some(option => 
            option.value === currentStatus);
            
        if (optionExists) {
            statusSelect.value = currentStatus;
        }
    }
    
    // Clear any previous status messages
    const statusMessage = document.getElementById('statusUpdateMessage');
    if (statusMessage) {
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
    }
    
    document.getElementById('detailsModal').style.display = 'flex';
}

/**
 * Close details modal
 */
function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

/************************************************
 * SEARCH FUNCTIONS
 ************************************************/

/**
 * Handle search input
 */
function handleSearch() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#transactionsTable tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchText) ? '' : 'none';
    });
}

/**
 * Clear search input
 */
function clearSearch() {
    document.getElementById('searchInput').value = '';
    handleSearch();
}

/************************************************
 * DATE FILTERING FUNCTIONS
 ************************************************/

/**
 * Handle date filter change
 */
function handleDateFilterChange() {
    const filterValue = document.getElementById('dateFilter').value;
    
    // Show/hide custom date range inputs
    if (filterValue === 'custom') {
        document.getElementById('customDateRange').style.display = 'block';
    } else {
        document.getElementById('customDateRange').style.display = 'none';
        
        // Apply selected filter immediately
        applyDateFilter(filterValue);
    }
}

/**
 * Apply date filter to transactions
 * @param {string} filterType - Type of filter (all, today, week, month)
 */
function applyDateFilter(filterType) {
    if (!allTransactions || allTransactions.length === 0) return;
    
    const now = new Date();
    let filteredTransactions = [];
    
    switch(filterType) {
        case 'all':
            filteredTransactions = [...allTransactions];
            break;
            
        case 'today':
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            filteredTransactions = allTransactions.filter(transaction => {
                const txDate = new Date(transaction.date);
                return txDate >= today;
            });
            break;
            
        case 'week':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            filteredTransactions = allTransactions.filter(transaction => {
                return new Date(transaction.date) >= weekAgo;
            });
            break;
            
        case 'month':
            const monthAgo = new Date(now);
            monthAgo.setDate(monthAgo.getDate() - 30);
            filteredTransactions = allTransactions.filter(transaction => {
                return new Date(transaction.date) >= monthAgo;
            });
            break;
    }
    
    // Update the UI with filtered transactions
    renderTransactionsTable(filteredTransactions);
    
    // THIS LINE IS MISSING - Update the transaction statistics based on filtered data
    updateTransactionStatistics(filteredTransactions);
    
    // Calculate and update item statistics based on filtered transactions
    const itemStats = calculateItemStats(filteredTransactions);
    updateItemStatistics(itemStats);
}

/**
 * Apply custom date range filter
 */
function applyCustomDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert("Please select both start and end dates");
        return;
    }
    
    // Convert to Date objects and set time to start/end of day
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // End of day
    
    const filteredTransactions = allTransactions.filter(transaction => {
        const txDate = new Date(transaction.date);
        return txDate >= start && txDate <= end;
    });
    
    // Update the UI with filtered transactions
    renderTransactionsTable(filteredTransactions);
    
    // THIS LINE IS MISSING - Update the transaction statistics based on filtered data
    updateTransactionStatistics(filteredTransactions);
    
    // Calculate and update item statistics based on filtered transactions
    const itemStats = calculateItemStats(filteredTransactions);
    updateItemStatistics(itemStats);
}















































/**
 * Generate random pastel colors for charts
 * @param {number} count - Number of colors to generate
 * @returns {Array} - Array of color strings
 */
function generatePastelColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        // Generate pastel colors
        const hue = (i * 55) % 360;
        colors.push(`hsla(${hue}, 70%, 80%, 0.8)`);
    }
    return colors;
}

/**
 * Create or update pie chart
 * @param {String} chartId - Canvas element ID
 * @param {Array} items - Items data for the chart
 * @param {String} legendId - Legend element ID
 * @param {Object} chart - Existing chart object (if updating)
 * @returns {Object} - New or updated chart object
 */
function createOrUpdatePieChart(chartId, items, legendId, chart) {
    const ctx = document.getElementById(chartId).getContext('2d');
    const legendElement = document.getElementById(legendId);
    
    // Clear any existing legend
    legendElement.innerHTML = '';
    
    // If no data, show message and return
    if (!items || items.length === 0) {
        document.getElementById(chartId).style.display = 'none';
        legendElement.innerHTML = '<div class="no-data-message">No data available</div>';
        return null;
    }
    
    // Show canvas
    document.getElementById(chartId).style.display = 'block';
    
    // Extract labels and data
    const labels = items.map(item => item.name);
    const data = items.map(item => item.count);
    const colors = generatePastelColors(items.length);
    
    // Create or update chart
    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.data.datasets[0].backgroundColor = colors;
        chart.update();
    } else {
        chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.formattedValue || '';
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Create custom legend
    items.forEach((item, index) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'chart-legend-item';
        legendItem.innerHTML = `
            <div class="color-box" style="background-color: ${colors[index]}"></div>
            <div>${item.name} (${item.count})</div>
        `;
        legendElement.appendChild(legendItem);
    });
    
    return chart;
}

/**
 * Update item statistics with pie charts
 * @param {Object} itemStats - Object with top_items and least_items arrays
 */
function updateItemStatistics(itemStats) {
    // Update chart headings to show how many items are displayed
    const itemsCount = itemStats.top_items.length;
    
    // Make headings match the chart IDs and data
    document.querySelector('.stats-card:nth-child(5) h3').textContent = 
        `Least ${itemsCount} Sold Items`;
    document.querySelector('.stats-card:nth-child(6) h3').textContent = 
        `Top ${itemsCount} Sold Items`;
    
    // Each chart gets its correct data - leastItemsChart gets least_items, etc.
    leastItemsChart = createOrUpdatePieChart('leastItemsChart', itemStats.least_items, 'leastItemsLegend', leastItemsChart);
    topItemsChart = createOrUpdatePieChart('topItemsChart', itemStats.top_items, 'topItemsLegend', topItemsChart);
}

/**
 * Display message when no item statistics are available
 */
function displayNoItemStats() {
    document.getElementById('topItemsLegend').innerHTML = '<div class="no-data-message">No data available</div>';
    document.getElementById('leastItemsLegend').innerHTML = '<div class="no-data-message">No data available</div>';
    
    // Hide the canvases
    document.getElementById('topItemsChart').style.display = 'none';
    document.getElementById('leastItemsChart').style.display = 'none';
}



// Update the items count value display when slider changes
const itemsCountFilter = document.getElementById('itemsCountFilter');
const itemsCountValue = document.getElementById('itemsCountValue');

if (itemsCountFilter) {
    // Set initial value
    itemsCountValue.textContent = itemsCountFilter.value;
    
    // Update display when slider moves (before releasing)
    itemsCountFilter.addEventListener('input', function() {
        itemsCountValue.textContent = this.value;
    });
    
    // Keep your existing change event listener for filtering
    itemsCountFilter.addEventListener('change', function() {
        // Re-apply the current date filter to update the display
        const currentFilter = document.getElementById('dateFilter').value;
        if (currentFilter === 'custom') {
            applyCustomDateRange();
        } else {
            applyDateFilter(currentFilter);
        }
    });
}



/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New status value
 */
async function updateOrderStatus(orderId, newStatus) {
    try {
        // Get CSRF token more safely
        const csrfTokenElement = document.querySelector('[name=csrfmiddlewaretoken]');
        let csrfToken = '';
        
        // If CSRF token isn't in the DOM, try to get it from cookies
        if (!csrfTokenElement) {
            csrfToken = getCookie('csrftoken');
        } else {
            csrfToken = csrfTokenElement.value;
        }
        
        if (!csrfToken) {
            throw new Error('CSRF token not found. Please refresh the page and try again.');
        }
        
        document.getElementById('statusUpdateMessage').textContent = "Updating status...";
        document.getElementById('statusUpdateMessage').className = "status-message info";
        
        const response = await fetch(`/transactions/api/update-status/${orderId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statusUpdateMessage').textContent = "Status updated successfully!";
            document.getElementById('statusUpdateMessage').className = "status-message success";
            
            // Update in the transactions table if it's visible
            const orderRow = document.querySelector(`tr[data-order-id="${orderId}"]`);
            if (orderRow) {
                const statusCell = orderRow.querySelector('.order-status');
                if (statusCell) {
                    statusCell.textContent = getStatusDisplayText(newStatus);
                    statusCell.className = `order-status status-${newStatus}`;
                }
            }
            
            // Update the status in our local data cache
            for (let i = 0; i < allTransactions.length; i++) {
                if (allTransactions[i].order_id === orderId) {
                    allTransactions[i].status = newStatus;
                    break;
                }
            }
            
            // FIX: Update the localStorage cache too
            const cachedDataString = localStorage.getItem('transactionData');
            if (cachedDataString) {
                const cachedData = JSON.parse(cachedDataString);
                if (cachedData.transactions) {
                    for (let i = 0; i < cachedData.transactions.length; i++) {
                        if (cachedData.transactions[i].order_id === orderId) {
                            cachedData.transactions[i].status = newStatus;
                            localStorage.setItem('transactionData', JSON.stringify(cachedData));
                            console.log(`Updated cached status for order ${orderId} to ${newStatus}`);
                            break;
                        }
                    }
                }
            }
            
            // Update transaction details cache if it exists
            const detailsCacheString = localStorage.getItem('transactionDetails');
            if (detailsCacheString) {
                const detailsCache = JSON.parse(detailsCacheString);
                if (detailsCache[orderId]) {
                    const orderDetails = detailsCache[orderId];
                    // If the cached details include status, update it
                    if (orderDetails.status !== undefined) {
                        orderDetails.status = newStatus;
                        localStorage.setItem('transactionDetails', JSON.stringify(detailsCache));
                    }
                }
            }
            
            // Refresh the order details view
            viewOrderDetails(orderId);
            
        } else {
            throw new Error(data.error || 'Failed to update status');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        document.getElementById('statusUpdateMessage').textContent = `Error: ${error.message}`;
        document.getElementById('statusUpdateMessage').className = "status-message error";
    }
}




/**
 * Helper function to get cookie value by name
 * @param {string} name - Cookie name
 * @returns {string} Cookie value
 */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Get display text for status code
 * @param {string} status - Status code
 * @returns {string} Display text
 */
function getStatusDisplayText(status) {
    const statusMap = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'successful': 'Successful',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || 'Unknown';
}






// Set up the event listener for the update status button
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('updateStatusBtn').addEventListener('click', function() {
        const orderIdElement = document.querySelector('#orderDetails [data-order-id]');
        if (!orderIdElement) return;
        
        const orderId = orderIdElement.getAttribute('data-order-id');
        const newStatus = document.getElementById('orderStatusSelect').value;
        
        updateOrderStatus(orderId, newStatus);
    });
});





