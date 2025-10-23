/**
 * EZ Food Chatbot
 * This file contains the functionality for the EZ Food virtual assistant chatbot
 * that helps users with information about the cafeteria services.
 */

// Dictionary of keyword-response pairs for the chatbot
// The keys are keywords that the system looks for in user messages
// The values are the responses the bot will give when those keywords are found
const responses = {
    // Greetings section
    "hello": "Hi there! How can I help you today?",
    "hi": "Hello! How can I help you today?",
    "hey": "Hey! What can I help you with today?",
    "good morning": "Good morning! How can I assist you today?",
    "good afternoon": "Good afternoon! How can I help you?",
    "good evening": "Good evening! What can I do for you today?",
    // Add this new key-value pair in the responses object
    "about platform": "This is EZ Food, a simple online cafeteria management system where you can order food and drinks from our cafeteria without any hassle. You can browse our menu, place orders, and manage your account all in one place.",
        
    // Menu related queries
    "menu": "We offer a variety of items including snacks, drinks, and desserts! You can browse our full menu on the main page under the Menu section.",
    "what food": "Our menu includes samosa, kachori, cocacola, and many more. Check out the Menu section for all available items!",
    
    // Ordering process information
    "order": "You can place an order by adding items to your cart and proceeding to checkout. Make sure you're logged in to your account first!",
    "how to order": "Simply browse our menu, click on items you'd like to order to add them to your cart, then click on the cart icon and follow the checkout process.",
    "add to cart": "To add an item to your cart, click on the '+' button or 'Add to Cart' button next to the item on our menu page.",
    "checkout": "To checkout, click on the cart icon in the top right corner, review your items, then click the 'Proceed to Checkout' button.",
    "minimum order": "There is no minimum order amount required.",
    "modify order": "You can modify your order by adjusting quantities in your cart before completing checkout.",
    "cancel order": "Once an order is placed, you cannot cancel it through the app. Please contact us immediately at 123-456-7890 if you need to cancel.",
    
    // Account management responses
    "account": "You can manage your account by clicking on the user icon in the navigation bar. There you can update your profile, view order history, and manage security settings.",
    "create account": "To create an account, click on the user icon and select 'Register'. Fill in the required information including security questions for account recovery.",
    "forgot password": "If you forgot your password, click on the 'Forgot Password' link on the login page. You'll need to answer your security questions to reset it.",
    "security questions": "Security questions are used to verify your identity if you need to reset your password. You set these up when creating your account.",
    "update profile": "To update your profile, click on the user icon, go to your profile page, and you can edit your information there.",
    "delete account": "To delete your account, please contact our support team at 1234@gmail.com.",
    
    // Payment-related information
    "payment": "We accept cash,online payment methods including UPI.",
    "refund": "Refunds are processed within 3-5 business days. Please contact our support team with your order details for assistance.",
    "receipt": "Digital receipts are automatically generated after each order. You can also find them in your order history.",
    "wallet": "Yes, we support most mobile wallets including Paytm, PhonePe, and Google Pay.",
    "upi": "Yes, we accept UPI payments. You can use any UPI app to make payments during checkout.",
    
    // Order tracking and history
    "order history": "You can view your complete order history by clicking on the history icon in the navigation bar or by visiting your profile page.",
    "track order": "You can track your current order status in the 'Order History' section. We also send status updates via SMS and email.",
    "recent order": "Your most recent orders can be found in the Order History section, accessible from the navigation bar.",
    
    // Delivery information
    "delivery": "We deliver within campus within 30 minutes of order placement. For off-campus deliveries, please expect 45-60 minutes.",
    "late delivery": "If your order is significantly delayed, please contact us at 123-456-7890 and we'll prioritize your delivery.",
    
    // Operating hours information
    "hours": "We're open from 8:00 AM to 10:00 PM every day, including weekends and holidays.",
    "open": "We're open from 8:00 AM to 10:00 PM every day of the week.",
    "close": "We close at 10:00 PM every day. The last orders are accepted until 9:30 PM.",
    "weekend": "Yes, we are open on weekends with the same hours: 8:00 AM to 10:00 PM.",
    "holiday": "We remain open during most holidays. Any special holiday hours will be announced on our homepage.",
    
    // Contact information
    "contact": "You can reach us at 123-456-7890 or email us at 1234@gmail.com. We also have a feedback form in the app.",
    "phone": "Our customer service phone number is 123-456-7890, available during our operating hours (8:00 AM to 10:00 PM).",
    "email": "You can email us at 1234@gmail.com for any queries or feedback.",
    "feedback": "We value your feedback! You can submit it through the Contact section of our app or email us directly.",
    "complaint": "We're sorry to hear you're having issues. Please call us at 123-456-7890 or email details to 1234@gmail.com for immediate assistance.",
    "speak manager": "If you need to speak with a manager, please call 123-456-7890 and ask to be connected to the manager on duty.",
    
    // General help information
    "help": "I can help you with information about our menu, ordering process, payment methods, delivery, account management, and more. Just ask me!",
    "faq": "You can find our full FAQ section by clicking on the Help section in the footer of our website.",
    "how chatbot": "I'm a virtual assistant designed to help answer your questions about our services. You can ask me about menu, ordering, delivery, and more!",
    "what is this": "This is EZ Food's virtual assistant chat. I'm here to help answer your questions about our cafeteria services!"
};

/**
 * Handles user message submission from the input field
 * Gets the user input, adds it to the chat, and processes a response
 * 
 * @debug - Check if userInput element exists
 * @debug - Verify that message is properly trimmed
 * @debug - Confirm response is generated and displayed
 */
function sendMessage() {
    // Get the input element and extract the message
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    
    // Only process non-empty messages
    if (message !== '') {
        // Add user message to the chat display
        addMessage(message, 'user');
        
        // Clear the input field after sending
        userInput.value = '';
        
        // Simulate processing time and generate response
        // Using setTimeout to mimic a natural conversation flow
        setTimeout(() => {
            // Get appropriate response based on user message
            const response = getBotResponse(message);
            
            // Display the bot's response
            addMessage(response, 'bot');
        }, 500); // 500ms delay to simulate processing
    }
}

/**
 * Adds a message to the chat display
 * Creates the DOM structure for the message with proper styling
 * 
 * @param {string} text - The message text to display
 * @param {string} sender - Either 'user' or 'bot' to identify the sender
 * 
 * @debug - Verify chatMessages element exists
 * @debug - Check that className assignments are correct
 * @debug - Ensure scrolling behavior works properly
 */
function addMessage(text, sender) {
    // Get the chat container
    const chatMessages = document.getElementById('chatMessages');
    
    // Create message row container
    const messageRow = document.createElement('div');
    messageRow.className = `message-row ${sender}-row`;
    
    // Create avatar element
    const avatar = document.createElement('div');
    avatar.className = `avatar ${sender}-avatar`;
    
    // Set appropriate icon based on sender
    if (sender === 'bot') {
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
    } else {
        avatar.innerHTML = '<i class="fas fa-user"></i>';
    }
    
    // Create message bubble
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    
    // Assemble and append elements to the DOM
    messageRow.appendChild(avatar);
    messageRow.appendChild(messageDiv);
    chatMessages.appendChild(messageRow);
    
    // Auto-scroll to the most recent message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Processes user message and returns appropriate bot response
 * Searches for keywords in the user's message to match with responses
 * 
 * @param {string} message - The user's message text
 * @returns {string} - The bot's response
 * 
 * @debug - Check if lowerMessage conversion works
 * @debug - Verify keyword matching logic
 * @debug - Test with various inputs to ensure proper matching
 */
function getBotResponse(message) {
    // Convert message to lowercase for case-insensitive matching
    const lowerMessage = message.toLowerCase();
    
    // Check for keywords in the message against our response dictionary
    for (const [keyword, response] of Object.entries(responses)) {
        // If the message contains any keyword, return its corresponding response
        if (lowerMessage.includes(keyword)) {
            return response;
        }
    }
    
    // Default response when no keywords match
    return "I'm sorry, I don't understand that question. You can ask about our menu, ordering process, payment methods, delivery options, or account management. Type 'help' for more options.";
}

/**
 * Resets the chat to its initial state
 * Clears all messages and displays a welcome message
 * 
 * @debug - Verify chatMessages element exists
 * @debug - Check if innerHTML clearing works properly
 * @debug - Ensure focus is set correctly
 */
function startNewChat() {
    // Get the chat container and clear all existing messages
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    // Display initial welcome message
    const welcomeMessage = "Hello! I'm EZ Food's virtual assistant. How can I help you today?";
    addMessage(welcomeMessage, 'bot');
    
    // Set focus to the input field for immediate typing
    document.getElementById('userInput').focus();
}

/**
 * Initialize the page when it loads
 * Sets up event listeners and initial state
 * 
 * @debug - Confirm userInput element exists
 * @debug - Verify newChatButton is found and event listener attached
 */
window.onload = function() {
    // Set focus to the input field when page loads
    document.getElementById('userInput').focus();
    
    // Add event listener to the "New Chat" button if it exists
    const newChatButton = document.querySelector('.new-chat');
    if (newChatButton) {
        newChatButton.addEventListener('click', startNewChat);
    } else {
        // Debug point - log if the button wasn't found
        console.log("Debug: New chat button not found in the DOM");
    }
    
    // You can add an initial welcome message here if desired
    // Uncomment the following line to do so:
    // startNewChat();
}