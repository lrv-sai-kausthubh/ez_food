from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .serializers import OrderSerializer
import logging
from .models import Order
from django.shortcuts import render, redirect
from .models import ShopUser
from django.utils import timezone
from django.contrib import messages
from django.contrib.auth.hashers import make_password
# Keep this comprehensive import
from .forms import (LoginForm, RegisterForm, ForgotPasswordForm, 
                   SecurityAnswerForm, PasswordResetForm)  # Use PasswordResetForm

import pytz

logger = logging.getLogger(__name__)

def cafe(request):
    if not request.session.get('shop_user_id'):
        return redirect('shop:shop_login')  # <-- add 'shop:' namespace
    return render(request, 'shop/cafe.html')

@api_view(['POST'])
def save_order(request):
    logger.info(f"Received order data: {request.data}")
    serializer = OrderSerializer(data=request.data)
    if serializer.is_valid():
        order = serializer.save()
        logger.info(f"Order saved with ID: {order.id}")
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    logger.error(f"Order validation errors: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



@api_view(['GET'])
def get_order_history(request):
    """Get order history from the database"""
    # Check if user is logged in
    if not request.session.get('shop_user_id'):
        return Response({"error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Get the current user's ID from the session
    user_id = request.session.get('shop_user_id')
    
    try:
        # Get the current user
        shop_user = ShopUser.objects.get(id=user_id)
        
        # Filter orders where student_id matches the user's name
        orders = Order.objects.filter(student_id=shop_user.name).order_by('-date_created')
        data = []
        
        for order in orders:
            order_items = []
            for item in order.items.all():
                order_items.append({
                    'name': item.name,
                    'price': float(item.price),
                    'quantity': item.quantity
                })
            
            order_data = {
                'orderId': order.order_id,
                'studentId': order.student_id,
                'date': int(order.date_created.timestamp() * 1000),
                'items': order_items
            }
            data.append(order_data)
        
        return Response(data)
        
    except ShopUser.DoesNotExist:
        # Handle case where user doesn't exist
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)



def login_view(request):
    error = None
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            try:
                # First get user by name
                user = ShopUser.objects.get(name=form.cleaned_data['name'])
                
                # Check password
                from django.contrib.auth.hashers import check_password
                if check_password(form.cleaned_data['password'], user.password):
                    request.session['shop_user_id'] = user.id
                    
                    # Important: Set a flag to clear localStorage on client side
                    request.session['clear_local_storage'] = True
                    
                    return redirect('shop:cafe')
                else:
                    error = "Invalid password. Please try again."
            except ShopUser.DoesNotExist:
                error = "Account not found. Please check your details."
    else:
        form = LoginForm()
    return render(request, 'shop/login.html', {'form': form, 'error': error})


def register_view(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            # Don't save the form directly
            user = form.save(commit=False)
            
            # Hash the password with Django's hasher
            user.password = make_password(user.password)
            
            # Now save the user with hashed password
            user.save()
            
            request.session['shop_user_id'] = user.id
            # Redirect to login page instead of cafe
            return redirect('shop:shop_login')
    else:
        form = RegisterForm()
    return render(request, 'shop/register.html', {'form': form})


def logout_view(request):
    request.session.flush()
    return redirect('shop:shop_login')

def cafe_view(request):
    # Get username from the logged-in user
    username = "Guest"
    if request.user.is_authenticated:
        # If you're using a custom user model that has a 'name' field
        if hasattr(request.user, 'name'):
            username = request.user.name
        # If you're using ShopUser model (based on your folder structure)
        elif hasattr(request.user, 'shopuser') and hasattr(request.user.shopuser, 'name'):
            username = request.user.shopuser.name
        # Default to Django's username field if others aren't available
        else:
            username = request.user.username
    
    context = {
        'username': username,
        # Include any other context variables you already have
    }
    return render(request, 'shop/cafe.html', context)



# Add this at the end of the file
def userhelp_view(request):
    """View for the chatbot help page"""
    if not request.session.get('shop_user_id'):
        return redirect('shop:shop_login')
    
    return render(request, 'shop/userhelp.html')


# Updated order_history_view to use the ShopUser model
# this order history compares names from db and if names match then it displays
def order_history_view(request):
    """View for showing the complete order history"""
    if not request.session.get('shop_user_id'):
        return redirect('shop:shop_login')
    
    user_id = request.session.get('shop_user_id')
    
    try:
        # Get the current user from ShopUser model
        shop_user = ShopUser.objects.get(id=user_id)


        # Option 2: Filter using the name field instead
        #filters by name instead of student id
        orders = Order.objects.filter(name__iexact=shop_user.name).order_by('-date_created')
        
        # Log for debugging
        print(f"User: {shop_user.name}, Found {orders.count()} orders")
        
        # Process order data for template
        formatted_orders = []
        ist = pytz.timezone('Asia/Kolkata')
        
        for order in orders:
            order_items = []
            total = 0
            
            for item in order.items.all():
                item_total = float(item.price) * item.quantity
                total += item_total
                order_items.append({
                    'name': item.name,
                    'price': float(item.price),
                    'quantity': item.quantity,
                    'item_total': f"{item_total:.2f}"
                })
            
            # Convert date to IST timezone
            local_datetime = timezone.localtime(order.date_created, ist)
            
            formatted_orders.append({
                'orderId': order.order_id,
                'studentId': order.student_id,  # This is actually the user's name
                'date': int(local_datetime.timestamp() * 1000),
                'date_formatted': local_datetime.strftime('%d %b %Y, %I:%M %p'),
                'items': order_items,
                'total': f"{total:.2f}",
                'status': order.status, # Include status
                'payment_method': order.payment_method  # Make sure this field exists
            })
        
        context = {
            'orders': formatted_orders
        }
        
        return render(request, 'shop/history.html', context)
        
    except ShopUser.DoesNotExist:
        # Handle case where user doesn't exist
        return redirect('shop:shop_login')

def forgot_password(request):
    error = None
    if request.method == 'POST':
        form = ForgotPasswordForm(request.POST)
        if form.is_valid():
            try:
                user = ShopUser.objects.get(name=form.cleaned_data['name'])
                request.session['reset_user_id'] = user.id
                return redirect('shop:security_questions')
            except ShopUser.DoesNotExist:
                error = "User not found. Please check your username."
    else:
        form = ForgotPasswordForm()
    return render(request, 'shop/forgot_password.html', {'form': form, 'error': error})

def security_questions(request):
    user_id = request.session.get('reset_user_id')
    if not user_id:
        return redirect('shop:forgot_password')
    
    try:
        user = ShopUser.objects.get(id=user_id)
    except ShopUser.DoesNotExist:
        return redirect('shop:forgot_password')
    
    error = None
    current_question = request.session.get('current_security_question', 1)
    
    if request.method == 'POST':
        form = SecurityAnswerForm(request.POST)
        if form.is_valid():
            answer = form.cleaned_data['answer'].lower().strip()
            correct_answer = ''
            
            if current_question == 1:
                correct_answer = user.security_answer1.lower().strip()
            elif current_question == 2 and user.security_question2:
                correct_answer = user.security_answer2.lower().strip()
            
            if answer == correct_answer:
                if current_question == 1 and user.security_question2:
                    request.session['current_security_question'] = 2
                    return redirect('shop:security_questions')
                else:
                    # All questions answered correctly
                    request.session['password_reset_authorized'] = True
                    return redirect('shop:reset_password')
            else:
                error = "Incorrect answer. Please try again."
    else:
        form = SecurityAnswerForm()
    
    # Get the current question text
    question_text = user.security_question1 if current_question == 1 else user.security_question2
    
    return render(request, 'shop/security_questions.html', {
        'form': form, 
        'error': error,
        'question': question_text,
        'question_number': current_question
    })

def reset_password(request):
    user_id = request.session.get('reset_user_id')
    is_authorized = request.session.get('password_reset_authorized')
    
    if not user_id or not is_authorized:
        return redirect('shop:forgot_password')
    
    try:
        user = ShopUser.objects.get(id=user_id)
    except ShopUser.DoesNotExist:
        return redirect('shop:forgot_password')
    
    if request.method == 'POST':
        form = PasswordResetForm(request.POST)
        if form.is_valid():
            new_password = form.cleaned_data['new_password']
            
            # Check if new password is same as old password
            from django.contrib.auth.hashers import check_password
            if check_password(new_password, user.password):
                form.add_error(None, "New password cannot be the same as your old password.")
            else:
                # Hash the new password before saving
                user.password = make_password(new_password)
                user.save()
                
                # Clear session variables
                request.session.pop('reset_user_id', None)
                request.session.pop('password_reset_authorized', None)
                request.session.pop('current_security_question', None)
                
                messages.success(request, "Your password has been reset successfully. Please log in with your new password.")
                return redirect('shop:shop_login')
    else:
        form = PasswordResetForm()
    
    return render(request, 'shop/reset_password.html', {'form': form})



def about_us(request):
    """View to display the About Us page"""
    return render(request, 'shop/about_us.html')

