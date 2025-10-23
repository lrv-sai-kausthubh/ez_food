from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpRequest
import json
import logging
import traceback
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
# Import models from shop app with explicit names to avoid confusion
from shop.models import Order as ShopOrder
from shop.models import OrderItem as ShopOrderItem

# Resolve import conflicts by using aliases for functions with the same name
from shop.views import save_order as shop_save_order
# Import models from current app for dual-database architecture
from managepayments.models import Order, OrderItem
from managepayments.serializers import OrderSerializer

# Add these imports at the top
import io
from django.http import FileResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from reportlab.lib.units import inch

import uuid
from django.views.decorators.csrf import csrf_exempt
from decimal import Decimal
import traceback
from django.urls import reverse
from urllib.parse import urlencode
from django.http import HttpResponseRedirect
import logging



# Configure application logging
logger = logging.getLogger(__name__)

def checkout_view(request):
    """
    Render the checkout template for payment processing.
    Requires user to be logged in - redirects to login if no session exists.
    Passes the current user's name to the template.
    """
    # Check if user is logged in, redirect to login if not
    if not request.session.get('shop_user_id'):
        return redirect('shop:shop_login')
    
    # Get current user's name to display in checkout page
    user_id = request.session.get('shop_user_id')
    try:
        from shop.models import ShopUser
        shop_user = ShopUser.objects.get(id=user_id)
        user_name = shop_user.name
    except Exception as e:
        # Log error but continue with empty name rather than failing
        logger.error(f"Error getting user name: {str(e)}")
        user_name = ""
    
    # Render checkout template with user name context
    return render(request, 'managepayments/checkout.html', {'user_name': user_name})

def update_inventory_after_order(cart_items):
    """
    Update inventory quantities after an order is placed.
    Uses multiple matching strategies to find inventory items by name:
    1. Exact match (case-insensitive)
    2. Partial match (item name contains search term)
    3. Reverse match (search term contains item name)
    
    Args:
        cart_items: List of dictionaries containing item details (name, quantity)
    
    Returns:
        Boolean indicating success or failure of inventory update
    """
    try:
        from dashboard.models import InventoryItem
        
        # Log all available inventory items for debugging purposes
        all_items = InventoryItem.objects.all()
        logger.info(f"Available inventory items: {', '.join(item.name for item in all_items)}")
        
        for item in cart_items:
            name = item['name']
            quantity = int(item['quantity'])
            
            logger.info(f"Updating inventory for '{name}', quantity: {quantity}")
            
            # Strategy 1: Find inventory item by exact name (case-insensitive)
            inventory_items = InventoryItem.objects.filter(name__iexact=name)
            
            if inventory_items.exists():
                logger.info(f"Found exact match for '{name}'")
            else:
                logger.info(f"No exact match for '{name}', trying partial match")
                
            # Strategy 2: If no direct match, try partial match (item contains search name)
            if not inventory_items.exists():
                inventory_items = InventoryItem.objects.filter(name__icontains=name)
                
                if inventory_items.exists():
                    logger.info(f"Found partial match for '{name}': {inventory_items.first().name}")
                else:
                    logger.info(f"No partial match for '{name}', trying reverse match")
            
            # Strategy 3: Try reverse match (search name contains item name)
            if not inventory_items.exists():
                found = False
                for inv_item in InventoryItem.objects.all():
                    if inv_item.name.lower() in name.lower():
                        inventory_item = inv_item
                        found = True
                        logger.info(f"Found reverse match for '{name}': {inv_item.name}")
                        break
                else:
                    found = False
            else:
                inventory_item = inventory_items.first()
                found = True
            
            # Update inventory quantity if a matching item was found
            if found:
                original_quantity = inventory_item.quantity
                # Ensure quantity never goes below zero
                inventory_item.quantity = max(0, original_quantity - quantity)
                inventory_item.save()
                logger.info(f"Updated inventory for '{inventory_item.name}': {original_quantity} → {inventory_item.quantity}")
            else:
                logger.warning(f"No inventory item found for '{name}'")
                
        return True
    except Exception as e:
        # Log error but don't crash the order process
        logger.error(f"Error updating inventory: {str(e)}")
        return False

def process_payment(request):
    """
    Process payment submission and save order to both databases.
    
    Handles form submission containing order details and payment information.
    Creates records in both managepayments and shop databases for consistency.
    Updates inventory quantities after successful order processing.
    
    Returns JSON response indicating success or failure.
    """
    if request.method == 'POST':
        try:
            # Extract all required data from the form submission
            name = request.POST.get('name')
            student_id = request.POST.get('student_id')
            payment_method = request.POST.get('payment_method')
            order_id = request.POST.get('order_id')
            cart_data = request.POST.get('cart_data')
            
            # Validate all required fields are present
            if not all([name, student_id, payment_method, order_id, cart_data]):
                return JsonResponse({'status': 'error', 'message': 'Missing required data'})
            
            # Parse JSON cart data into Python structure
            cart_items = json.loads(cart_data)
            
            # Get user ID from session for verification and association
            user_id = request.session.get('shop_user_id')
            
            # Security check: verify submitted name matches logged-in user's name
            # This prevents placing orders on behalf of another person
            try:
                from shop.models import ShopUser
                shop_user = ShopUser.objects.get(id=user_id)
                if shop_user.name != name:
                    logger.error(f"Name mismatch: submitted '{name}' but logged in as '{shop_user.name}'")
                    return JsonResponse({
                        'status': 'error', 
                        'message': 'You can only place orders with your own account name.'
                    })
            except Exception as e:
                logger.error(f"Error verifying user name: {str(e)}")
                return JsonResponse({'status': 'error', 'message': 'User authentication error'})
            
            # Save order to both databases for data consistency
            try:
                # Create order in managepayments app database
                logger.info(f"Creating order in managepayments database: {order_id} for student {student_id}")
                order = Order.objects.create(
                    order_id=order_id,
                    student_id=student_id,
                    user_id=user_id,
                    name=name,
                    payment_method=payment_method,
                )
                
                # Create order in shop app database - dual database architecture
                logger.info(f"Creating order in shop database: {order_id}")
                shop_order = ShopOrder.objects.create(
                    order_id=order_id,
                    student_id=student_id,
                    name=name,
                    payment_method=payment_method,
                    # Shop model uses date_created with default=timezone.now
                )
                
                # Create individual order items in managepayments database
                for item in cart_items:
                    OrderItem.objects.create(
                        order=order,
                        name=item['name'],
                        price=float(item['price']),
                        quantity=int(item['quantity'])
                    )
                    
                    # Also create items in shop app database for consistency
                    ShopOrderItem.objects.create(
                        order=shop_order,
                        name=item['name'],
                        price=float(item['price']),
                        quantity=int(item['quantity'])
                    )
                
                logger.info(f"Successfully saved order {order_id} to both databases with {len(cart_items)} items")
                
                # Update inventory quantities after successful order
                try:
                    update_inventory_after_order(cart_items)
                    logger.info(f"Inventory updated for order {order_id}")
                except Exception as e:
                    # Log error but don't fail the order if inventory update fails
                    logger.error(f"Error updating inventory: {str(e)}")
                
                # Return success response with order ID
                return JsonResponse({'status': 'success', 'order_id': order_id})
            
            except Exception as e:
                # Log detailed error for database operations
                logger.error(f"Error saving order to database: {str(e)}\n{traceback.format_exc()}")
                return JsonResponse({
                    'status': 'error', 
                    'message': f'Failed to save order to database: {str(e)}'
                })
                
        except json.JSONDecodeError:
            # Handle malformed JSON data in cart
            logger.error("Invalid JSON data in request")
            return JsonResponse({'status': 'error', 'message': 'Invalid cart data format'})
        except Exception as e:
            # Catch any other unexpected errors
            logger.error(f"Error processing payment: {str(e)}\n{traceback.format_exc()}")
            return JsonResponse({'status': 'error', 'message': str(e)})
            
    # Return error for non-POST requests
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

def payment_confirmation(request):
    """
    Render payment confirmation page after successful order.
    Requires user to be logged in - redirects to login if no session exists.
    """
    if not request.session.get('shop_user_id'):
        return redirect('shop:shop_login')
    return render(request, 'managepayments/confirmation.html')

@api_view(['POST'])
def save_order(request):
    """
    API endpoint to save order to the database.
    
    Creates order records in both managepayments and shop databases.
    Uses Django REST Framework serializers for validation.
    
    Request data should include order details and an array of items.
    Returns serialized order data if successful, errors otherwise.
    """
    try:
        # Log incoming data for debugging purposes
        logger.info(f"Received order data: {request.data}")
        
        # Validate data using DRF serializer
        serializer = OrderSerializer(data=request.data)
        
        if serializer.is_valid():
            # Save the order in managepayments model first
            order = serializer.save()
            
            # Also save to shop model for dual-database architecture
            shop_order = ShopOrder.objects.create(
                order_id=request.data['order_id'],
                student_id=request.data['student_id'],
                name=request.data.get('name', ''),
                payment_method=request.data.get('payment_method', ''),
            )
            
            # Create order items for both database models if items are provided
            if 'items' in request.data:
                for item_data in request.data['items']:
                    # Create in managepayments model
                    OrderItem.objects.create(
                        order=order,
                        name=item_data['name'],
                        price=item_data['price'],
                        quantity=item_data['quantity']
                    )
                    
                    # Create in shop model for consistency
                    ShopOrderItem.objects.create(
                        order=shop_order,
                        name=item_data['name'],
                        price=item_data['price'],
                        quantity=item_data['quantity']
                    )
            
            logger.info(f"Order saved to both databases with ID: {order.id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # Log validation errors in detail for debugging
        logger.error(f"Order validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        # Log the full exception details for easier debugging
        logger.error(f"Error saving order: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def update_inventory(request):
    """
    API endpoint to update inventory quantity for an item after purchase.
    
    Uses multiple matching strategies to find the correct inventory item:
    1. Exact match (case-insensitive)
    2. Partial match (item name contains search term)
    3. Reverse match (search term contains item name)
    
    Returns updated inventory information if successful.
    """
    try:
        # Extract request data
        data = request.data
        item_name = data.get('itemName')
        quantity = int(data.get('quantity', 0))
        
        # Validate required parameters
        if not item_name or quantity <= 0:
            return Response({'error': 'Invalid item data'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Import model from dashboard app
        from dashboard.models import InventoryItem
        
        # Strategy 1: Find the item by exact name (case-insensitive)
        inventory_items = InventoryItem.objects.filter(name__iexact=item_name)
        
        # Strategy 2: If no exact match, try partial match
        if not inventory_items.exists():
            inventory_items = InventoryItem.objects.filter(name__icontains=item_name)
            
            # Strategy 3: If still no match, try the reverse match
            if not inventory_items.exists():
                found = False
                for inv_item in InventoryItem.objects.all():
                    if inv_item.name.lower() in item_name.lower():
                        inventory_item = inv_item
                        found = True
                        break
                else:
                    found = False
            else:
                inventory_item = inventory_items.first()
                found = True
        else:
            inventory_item = inventory_items.first()
            found = True
        
        # Handle case where no matching item was found
        if not found:
            logger.warning(f"No inventory item found for '{item_name}'")
            return Response(
                {'error': f'No inventory item found for {item_name}'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update inventory quantity, ensuring it never goes below zero
        original_quantity = inventory_item.quantity
        inventory_item.quantity = max(0, original_quantity - quantity)
        inventory_item.save()
        
        logger.info(f"Updated inventory for '{inventory_item.name}': {original_quantity} -> {inventory_item.quantity}")
        
        # Return detailed response about the inventory update
        return Response({
            'item': inventory_item.name,
            'previous': original_quantity,
            'purchased': quantity,
            'remaining': inventory_item.quantity
        })
        
    except Exception as e:
        # Log detailed error info for debugging
        logger.error(f"Error updating inventory: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




@api_view(['GET'])
def get_order_history(request):
    """
    API endpoint to retrieve order history for the current user.
    
    If user is logged in, returns only their orders.
    Otherwise returns all orders (for testing/demo purposes).
    Formats response for frontend consumption with nested items.
    Returns empty list on error to prevent UI disruption.
    """
    try:
        # Get the user ID from the session to filter orders
        user_id = request.session.get('shop_user_id')
        
        # Filter orders by user ID if available, otherwise return all orders
        if user_id:
            orders = Order.objects.filter(user_id=user_id).order_by('-date_created')
        else:
            # Get all orders (for demo/testing purposes)
            orders = Order.objects.all().order_by('-date_created')
        
        # Initialize empty list to store formatted order data
        data = []
        
        for order in orders:
            # Get all items for this order using related name 'items'
            # The hasattr check prevents errors if the relation doesn't exist
            order_items = order.items.all() if hasattr(order, 'items') else []
            
            # Format items into a list of dictionaries for the response
            items_data = []
            for item in order_items:
                items_data.append({
                    'name': item.name,
                    'price': float(item.price),  # Convert Decimal to float for JSON serialization
                    'quantity': item.quantity
                })
            
            # Build complete order object with metadata and items
            order_data = {
                'orderId': order.order_id,
                'studentId': order.student_id,
                # Convert Django datetime to Unix timestamp (milliseconds) for JavaScript
                # The hasattr check handles edge cases where date_created might be missing
                'date': int(order.date_created.timestamp() * 1000) if hasattr(order, 'date_created') else int(timezone.now().timestamp() * 1000),
                'items': items_data
            }
            
            # Add this formatted order to the response array
            data.append(order_data)
        
        # Return all orders as JSON response
        return Response(data)
        
    except Exception as e:
        # Log the error but return empty list instead of error response
        # This prevents UI disruption when the backend has issues
        logger.error(f"Error retrieving order history: {str(e)}\n{traceback.format_exc()}")
        return Response([])
    
# this feature allows users to download a PDF receipt for their completed order
# It generates a PDF with order details and returns it as a downloadable file.

# Add this function to your views.py file
def download_receipt(request):
    """
    Generate and download a PDF receipt for a completed order
    """
    # Get order ID from request parameters
    order_id = request.GET.get('order_id')
    
    if not order_id:
        return redirect('shop:shop_login')
    
    try:
        # Get order details from the database
        order = Order.objects.get(order_id=order_id)
        order_items = OrderItem.objects.filter(order=order)
        
        # Create a file-like buffer to receive PDF data
        buffer = io.BytesIO()
        
        # Create the PDF object, using the buffer as its "file"
        p = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Add the receipt header
        p.setFont("Helvetica-Bold", 24)
        p.drawString(72, height - 72, "EZ FOOD Receipt")
        
        # Add logo (if available)
        # p.drawImage("path/to/logo.png", 400, height - 100, width=150, height=50)
        
        # Add Order Information
        p.setFont("Helvetica-Bold", 14)
        p.drawString(72, height - 120, f"Order #{order.order_id}")
        
        p.setFont("Helvetica", 12)
        p.drawString(72, height - 140, f"Date: {order.date.strftime('%d-%m-%Y %H:%M:%S')}")
        p.drawString(72, height - 160, f"Student ID: {order.student_id}")
        p.drawString(72, height - 180, f"Customer: {order.name}")
        p.drawString(72, height - 200, f"Payment Method: {order.payment_method}")
        
        # Add table headers
        data = [["Item", "Quantity", "Price", "Total"]]
        
        # Add order items to the table
        total = 0
        for item in order_items:
            subtotal = item.price * item.quantity
            total += subtotal
            data.append([
                item.name,
                str(item.quantity),
                f"₹{item.price:.2f}",
                f"₹{subtotal:.2f}"
            ])
        
        # Add total row
        data.append(["", "", "Grand Total:", f"₹{total:.2f}"])
        
        # Create the table
        table = Table(data, colWidths=[200, 100, 100, 100])
        
        # Add style to the table
        style = TableStyle([
            ('BACKGROUND', (0, 0), (3, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (3, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, -1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -2), 1, colors.black),
            ('LINEBELOW', (0, -1), (-1, -1), 2, colors.black),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ])
        table.setStyle(style)
        
        # Draw the table on the PDF
        table.wrapOn(p, width - 144, height)
        table.drawOn(p, 72, height - 350)
        
        # Add footer
        p.setFont("Helvetica", 10)
        p.drawString(72, 72, "Thank you for your order!")
        p.drawString(72, 58, "For any queries, please contact us at 123-456-7890")
        
        # Close the PDF object
        p.showPage()
        p.save()
        
        # FileResponse sets the Content-Disposition header
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f'EZ_FOOD_Receipt_{order_id}.pdf')
    
    except Order.DoesNotExist:
        # Handle case when order doesn't exist
        return redirect('shop:shop_login')
    except Exception as e:
        # Log the error and redirect
        logger.error(f"Error generating receipt: {str(e)}")
        return redirect('shop:shop_login')




# Create a logger
logger = logging.getLogger(__name__)


def create_mock_payment(request):
    """Create a mock Razorpay payment page for checkout"""
    try:
        # Get cart data from the POST request
        name = request.POST.get('name')
        student_id = request.POST.get('student_id')
        payment_method = request.POST.get('payment_method')
        order_id = request.POST.get('order_id')
        cart_data = request.POST.get('cart_data')
        
        # Check if we have all required data
        if not all([name, student_id, payment_method, order_id, cart_data]):
            return JsonResponse({'status': 'error', 'message': 'Missing required data'})
        
        # Get delivery info for classroom delivery
        delivery_info = None
        if payment_method == 'classroom_delivery':
            delivery_info = {
                'floor_number': request.POST.get('floor_number'),
                'classroom': request.POST.get('classroom'),
                'delivery_time': request.POST.get('delivery_time'),
                'delivery_notes': request.POST.get('delivery_notes', '')
            }
        
        # Parse cart data
        cart_items = json.loads(cart_data)
        total_amount = sum(item['price'] * item['quantity'] for item in cart_items)
        
        # Generate a mock Razorpay order ID
        mock_razorpay_order_id = f"order_{uuid.uuid4().hex[:10]}"
        
        # Store these details in session for retrieval after payment
        request.session['payment_data'] = {
            'name': name,
            'student_id': student_id,
            'payment_method': payment_method,
            'order_id': order_id,
            'cart_data': cart_data,
            'razorpay_order_id': mock_razorpay_order_id,
        }
        
        # Add delivery info to session if available
        if delivery_info:
            request.session['payment_data']['delivery_info'] = delivery_info

        # IMPORTANT: Save session immediately after modification
        request.session.modified = True
        
        # For Cash on Delivery, skip payment page and directly process payment
        if payment_method == 'cash':
            # Create a direct success URL with all necessary parameters
            success_params = {
                'razorpay_order_id': mock_razorpay_order_id,
                'razorpay_payment_id': f'cash_payment{mock_razorpay_order_id}',
                'razorpay_signature': 'mock_signature',
                'status': 'success',
                'order_id': order_id,
                'payment_method': 'cash'
            }
            success_url = f"{request.build_absolute_uri(reverse('managepayments:payment_callback'))}?{urlencode(success_params)}"
            
            return JsonResponse({
                'status': 'success',
                'redirect_url': success_url
            })
        
        # Handle UPI payment method
        elif payment_method == 'upi':
            # Generate QR code for UPI payment
            qr_code = generate_upi_qr(
                order_id=order_id,
                amount=total_amount,
                student_name=name,
                student_id=student_id
            )
            
            # Store QR code in session
            request.session['payment_data']['qr_code'] = qr_code
            request.session.modified = True
            
            # Create UPI payment URL
            upi_payment_url = request.build_absolute_uri(reverse('managepayments:show_upi_payment'))
            upi_payment_url += f"?order_id={order_id}&amount={total_amount}"
            
            # Return the UPI payment URL for redirection
            return JsonResponse({
                'status': 'success',
                'redirect_url': upi_payment_url
            })
            
        else:
            # For other payment methods (card, classroom_delivery, etc.)
            mock_razorpay_url = (
                request.build_absolute_uri(reverse('managepayments:show_mock_razorpay')) + 
                f"?order_id={order_id}&amount={total_amount}&payment_method={payment_method}"
            )
            
            return JsonResponse({
                'status': 'success',
                'redirect_url': mock_razorpay_url
            })
            
    except Exception as e:
        import traceback
        logger.error(f"Error creating mock payment: {str(e)}\n{traceback.format_exc()}")
        return JsonResponse({
            'status': 'error', 
            'message': f'Payment processing failed: {str(e)}'
        })



def show_mock_razorpay(request):
    """Display the mock Razorpay payment page"""
    try:
        # Get data from session
        payment_data = request.session.get('payment_data', {})
        if not payment_data:
            return redirect('managepayments:checkout')
            
        # Get URL parameters
        order_id = request.GET.get('order_id')
        payment_method = request.GET.get('payment_method', 'card')
        
        # Prepare checkout data for template
        checkout_data = {
            'razorpay_order_id': payment_data.get('razorpay_order_id'),
            'razorpay_amount': float(request.GET.get('amount', 0)),
            'currency': 'INR',
            'customer_name': payment_data.get('name'),
            'order': {'order_id': order_id},
            'payment_method': payment_method,
            'callback_url': request.build_absolute_uri(reverse('managepayments:payment_callback')),
        }
        
        # Include delivery info for classroom delivery
        if payment_method == 'classroom_delivery' and 'delivery_info' in payment_data:
            checkout_data['delivery_info'] = payment_data.get('delivery_info')
        
        return render(request, 'managepayments/mock_razorpay.html', checkout_data)
        
    except Exception as e:
        logger.error(f"Error showing mock Razorpay: {str(e)}\n{traceback.format_exc()}")
        return redirect('managepayments:checkout')





@csrf_exempt
def payment_callback(request):
    """Handle the callback from mock Razorpay payment"""
    # Get data from request
    razorpay_order_id = request.GET.get('razorpay_order_id')
    razorpay_payment_id = request.GET.get('razorpay_payment_id')
    status = request.GET.get('status')
    order_id = request.GET.get('order_id')
    payment_method = request.GET.get('payment_method', '')
    
    # Get stored data from session
    payment_data = request.session.get('payment_data', {})
    
    if status == 'success' and payment_data:
        try:
            # Extract data from session
            name = payment_data.get('name')
            student_id = payment_data.get('student_id')
            payment_method = payment_data.get('payment_method')
            order_id = payment_data.get('order_id')
            cart_data = payment_data.get('cart_data')
            
            # Get delivery info if available
            delivery_info = payment_data.get('delivery_info')
            
            # Parse cart items
            cart_items = json.loads(cart_data)
            
            # Get user ID from session
            user_id = request.session.get('shop_user_id')
            
            # Create order in managepayments app database
            logger.info(f"Creating order in managepayments database: {order_id} for student {student_id}")
            order = Order.objects.create(
                order_id=order_id,
                student_id=student_id,
                user_id=user_id,
                name=name,
                payment_method=payment_method,
            )
            
            # Create order in shop app database - dual database architecture
            logger.info(f"Creating order in shop database: {order_id}")
            shop_order = ShopOrder.objects.create(
                order_id=order_id,
                student_id=student_id,
                name=name,
                payment_method=payment_method,
            )
            
            # Add payment details (mock)
            order.payment_id = razorpay_payment_id
            shop_order.payment_id = razorpay_payment_id
            
            # Set status to in progress so that it can be changed manually later
            order.status = 'in_progress'
            shop_order.status = 'in_progress'
            
            # Save delivery info for classroom delivery
            if delivery_info and payment_method == 'classroom_delivery':
                try:
                    # Try creating a DeliveryInfo object (if the model exists)
                    from managepayments.models import DeliveryInfo
                    delivery = DeliveryInfo.objects.create(
                        order=order,
                        floor_number=delivery_info.get('floor_number'),
                        classroom=delivery_info.get('classroom'),
                        delivery_time=delivery_info.get('delivery_time'),
                        delivery_notes=delivery_info.get('delivery_notes', '')
                    )
                    logger.info(f"Created delivery info record for order {order_id}")
                except ImportError:
                    # If no DeliveryInfo model exists, store as JSON in the order
                    logger.info("DeliveryInfo model not found, storing as JSON")
                    # Store as JSON in notes field (assuming Order has a notes field)
                    order.notes = json.dumps(delivery_info)
                    shop_order.notes = json.dumps(delivery_info)
                    
            # Save the updated orders
            order.save()
            shop_order.save()
            
            # Create individual order items in managepayments database
            for item in cart_items:
                OrderItem.objects.create(
                    order=order,
                    name=item['name'],
                    price=float(item['price']),
                    quantity=int(item['quantity'])
                )
                
                # Also create items in shop app database for consistency
                ShopOrderItem.objects.create(
                    order=shop_order,
                    name=item['name'],
                    price=float(item['price']),
                    quantity=int(item['quantity'])
                )
                
            logger.info(f"Order saved to both databases with ID: {order.id}")
            
            # Update inventory quantities after successful order
            try:
                update_inventory_after_order(cart_items)
                logger.info(f"Inventory updated for order {order_id}")
            except Exception as e:
                # Log error but don't fail the order if inventory update fails
                logger.error(f"Error updating inventory: {str(e)}")
            
            # Calculate total amount for display
            total_amount = sum(item['price'] * item['quantity'] for item in cart_items)
            order.total_amount = total_amount
            
            # Clear payment data from session
            if 'payment_data' in request.session:
                del request.session['payment_data']
            
            # Return success page
            return render(request, 'managepayments/payment_success.html', {'order': order})
            
        except Exception as e:
            logger.error(f"Error processing payment callback: {str(e)}\n{traceback.format_exc()}")
            return render(request, 'managepayments/payment_failure.html', {'error': str(e)})
    else:
        # Payment failed or invalid data
        return render(request, 'managepayments/payment_failure.html', {'error': 'Invalid payment data'})






#upi qr code generator and testing


# Add these imports at the top
import qrcode
import io
import base64
from django.conf import settings
import os

def generate_upi_qr(order_id, amount, student_name, student_id):
    """
    Generate a UPI QR code with order details embedded
    
    Parameters:
    - order_id: Unique order identifier
    - amount: Payment amount
    - student_name: Name of the student
    - student_id: Student ID
    
    Returns:
    - Base64 encoded image data for embedding in HTML
    """
    # UPI ID for the cafeteria (replace with your actual UPI ID)
    upi_id = "dummyid@bank"
    
    # Create a transaction note that includes identifiable information
    transaction_note = f"ORDER{order_id}-{student_id}"
    
    # Build the UPI URL with all parameters
    upi_url = (
        f"upi://pay?pa={upi_id}"
        f"&pn=EZ FOOD CAFETERIA"
        f"&am={amount}"
        f"&tr={order_id}"
        f"&tn={transaction_note}"
    )
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(upi_url)
    qr.make(fit=True)
    
    # Create an image from the QR Code
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to in-memory buffer
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    # Convert to base64 for embedding in HTML
    img_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{img_str}"





def show_upi_payment(request):
    """Display the UPI payment page with QR code"""
    try:
        # Get data from session with debug output
        payment_data = request.session.get('payment_data', {})
        print(f"DEBUG: Session payment_data in show_upi_payment: {payment_data}")
        print(f"DEBUG: Session ID: {request.session.session_key}")
        
        if not payment_data:
            print("DEBUG: No payment data found in session, redirecting to checkout")
            return redirect('managepayments:checkout')
            
        # Get URL parameters
        order_id = request.GET.get('order_id')
        amount = float(request.GET.get('amount', 0))
        
        # For debugging - check if QR code exists
        qr_code = payment_data.get('qr_code')
        if not qr_code:
            print("DEBUG: QR code missing, generating new one")
            # Generate QR code on the fly if missing
            qr_code = generate_upi_qr(
                order_id=order_id,
                amount=amount,
                student_name=payment_data.get('name', 'Customer'),
                student_id=payment_data.get('student_id', 'Unknown')
            )
            # Save it back to session
            request.session['payment_data']['qr_code'] = qr_code
            request.session.modified = True
        
        # Prepare data for template
        context = {
            'order_id': order_id,
            'amount': amount,
            'qr_code': qr_code,
            'student_id': payment_data.get('student_id'),
            'name': payment_data.get('name'),
        }
        
        return render(request, 'managepayments/upi_payment.html', context)
        
    except Exception as e:
        import traceback
        error_msg = f"Error showing UPI payment: {str(e)}\n{traceback.format_exc()}"
        print(f"DEBUG: {error_msg}")
        logger.error(error_msg)
        return redirect('managepayments:checkout')




def process_upi_payment(request):
    """Process UPI payment after user confirms they've completed the payment"""
    try:
        # Get payment data from session
        payment_data = request.session.get('payment_data', {})
        if not payment_data:
            return redirect('managepayments:checkout')
        
        # Extract data from session
        name = payment_data.get('name')
        student_id = payment_data.get('student_id')
        payment_method = payment_data.get('payment_method')
        order_id = payment_data.get('order_id')
        cart_data = payment_data.get('cart_data')
        
        # Parse cart items
        cart_items = json.loads(cart_data)
        
        # Get user ID from session
        user_id = request.session.get('shop_user_id')
        
        # Create order in managepayments app database
        logger.info(f"Creating UPI order in managepayments database: {order_id} for student {student_id}")
        order = Order.objects.create(
            order_id=order_id,
            student_id=student_id,
            user_id=user_id,
            name=name,
            payment_method=payment_method,
        )
        
        # Create order in shop app database - dual database architecture
        logger.info(f"Creating UPI order in shop database: {order_id}")
        shop_order = ShopOrder.objects.create(
            order_id=order_id,
            student_id=student_id,
            name=name,
            payment_method=payment_method,
        )
        
        # Add mock payment ID
        mock_payment_id = f"upi_{uuid.uuid4().hex[:10]}"
        order.payment_id = mock_payment_id
        shop_order.payment_id = mock_payment_id
        
        # Set status to in progress so that it can be changed manually later
        order.status = 'in_progress'
        shop_order.status = 'in_progress'
        
        # Save the updated orders
        order.save()
        shop_order.save()
        
        # Create individual order items in managepayments database
        for item in cart_items:
            OrderItem.objects.create(
                order=order,
                name=item['name'],
                price=float(item['price']),
                quantity=int(item['quantity'])
            )
            
            # Also create items in shop app database for consistency
            ShopOrderItem.objects.create(
                order=shop_order,
                name=item['name'],
                price=float(item['price']),
                quantity=int(item['quantity'])
            )
            
        logger.info(f"UPI order saved to both databases with ID: {order.id}")
        
        # Update inventory quantities after successful order
        try:
            update_inventory_after_order(cart_items)
            logger.info(f"Inventory updated for UPI order {order_id}")
        except Exception as e:
            logger.error(f"Error updating inventory: {str(e)}")
        
        # Calculate total amount for display
        total_amount = sum(item['price'] * item['quantity'] for item in cart_items)
        order.total_amount = total_amount
        
        # Clear payment data from session
        if 'payment_data' in request.session:
            del request.session['payment_data']
        
        # Return success page with order object
        return render(request, 'managepayments/payment_success.html', {'order': order})
        
    except Exception as e:
        logger.error(f"Error processing UPI payment: {str(e)}\n{traceback.format_exc()}")
        return render(request, 'managepayments/payment_failure.html', {'error': str(e)})
    








# views for deliver to class feature


def deliver_to_class_view(request):
    """Display the deliver to class form"""
    # Get the logged in user's name if available
    user_name = request.user.get_full_name() if request.user.is_authenticated else ""
    
    return render(request, 'managepayments/deliver_to_class.html', {
        'user_name': user_name
    })

def process_delivery_view(request):
    """Process the classroom delivery form"""
    if request.method == 'POST':
        # Get form data
        student_name = request.POST.get('student_name')
        student_id = request.POST.get('student_id')
        floor_number = request.POST.get('floor_number')
        classroom = request.POST.get('classroom')
        delivery_time = request.POST.get('delivery_time')
        delivery_notes = request.POST.get('delivery_notes', '')
        
        # Store delivery info in session
        request.session['delivery_info'] = {
            'floor_number': floor_number,
            'classroom': classroom,
            'delivery_time': delivery_time,
            'delivery_notes': delivery_notes,
            'delivery_fee': 10.00  # Fixed delivery fee
        }
        
        # Redirect to checkout page
        return redirect('managepayments:checkout')
        
    # If not POST, redirect to the form
    return redirect('managepayments:deliver_to_class')