import re
import os
import sys
import django
from datetime import datetime

# Add the project root directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cafeteria_management_system.settings')
django.setup()

# Import your Order model
from shop.models import Order
from django.utils import timezone

# Define authorized staff phone numbers that can receive payment notifications
AUTHORIZED_STAFF_NUMBERS = [
    '+919876543210',  # Add your staff phone numbers here
    '+919876543211',
    # Add more staff numbers as needed
]

def process_sms_message(sender, body, received_at=None):
    """
    Process an SMS message to detect payment confirmations and update order status.
    
    Args:
        sender (str): Phone number that sent the SMS
        body (str): The SMS message body
        received_at (datetime): When the SMS was received (optional)
    
    Returns:
        dict: Processing result with status and message
    """
    print(f"🔍 Processing SMS from: {sender}")
    print(f"📱 Message: {body[:100]}...")
    
    # Check if this is an automated test (no sender verification needed)
    is_test = sender == 'Test'
    
    # Verify sender is an authorized staff number
    if not is_test and sender not in AUTHORIZED_STAFF_NUMBERS:
        print(f"❌ Unauthorized sender: {sender}")
        return {
            "success": False,
            "message": "SMS not from authorized staff number"
        }
    
    # Extract order ID pattern: CMS-XXXXXX (6 digits)
    order_match = re.search(r'[cC][mM][sS]-(\d{6})', body)
    
    # Extract payment amount if available
    amount_match = re.search(r'(?:Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{2})?)', body)
    amount = amount_match.group(1).replace(',', '') if amount_match else None
    
    # Try to extract transaction ID or reference
    reference_match = re.search(r'(?:UPI Ref|Ref No|Reference|txn id|txn)[:\s]*([A-Za-z0-9]+)', body, re.IGNORECASE)
    reference = reference_match.group(1) if reference_match else None
    
    if order_match:
        order_id = f"CMS-{order_match.group(1)}"
        print(f"🎯 Found Order ID: {order_id}")
        
        if amount:
            print(f"💰 Amount: ₹{amount}")
            
        if reference:
            print(f"🔢 Reference: {reference}")
            
        # Connect to the database and update order status
        try:
            order = Order.objects.filter(order_id=order_id).first()
            
            if order:
                print(f"📋 Found matching order in database: {order_id}")
                
                if order.status.lower() != 'successful':  # Case-insensitive comparison
                    old_status = order.status
                    order.status = 'successful'
                    
                    # Try to update payment date if the field exists
                    try:
                        order.payment_date = timezone.now()
                    except:
                        pass  # Field might not exist
                        
                    order.payment_reference = reference if reference else "Verified via SMS"
                    order.save()
                    print(f"✅ Updated order status from '{old_status}' to 'successful'")
                    return {
                        "success": True, 
                        "message": f"Order {order_id} status updated to successful"
                    }
                else:
                    print(f"⏭️ Order {order_id} already marked as successful")
                    return {
                        "success": True, 
                        "message": f"Order {order_id} already marked as successful"
                    }
            else:
                print(f"❌ No matching order found in database for ID: {order_id}")
                return {
                    "success": False, 
                    "message": f"No matching order found for ID: {order_id}"
                }
        except Exception as e:
            print(f"❌ Error updating database: {str(e)}")
            return {
                "success": False, 
                "message": f"Error updating database: {str(e)}"
            }
    else:
        print("⚠️ No order ID found in this SMS")
        return {
            "success": False, 
            "message": "No order ID found in SMS message"
        }


