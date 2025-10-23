from django.shortcuts import render, redirect
from .models import UserProfile
from django.contrib.auth.decorators import login_required
from shop.models import ShopUser


def profile(request):
    # Check if user is logged in via shop session
    shop_user_id = request.session.get('shop_user_id')
    
    # If not logged in, redirect to login page
    if not shop_user_id:
        return redirect('shop:shop_login')
    
    try:
        # Get the shop user
        shop_user = ShopUser.objects.get(id=shop_user_id)
        
        # Get or create a corresponding UserProfile
        user_profile, created = UserProfile.objects.get_or_create(
            shop_user_id=shop_user_id,
            defaults={
                'name': shop_user.name,
                'email': shop_user.email,
                'phone_number': shop_user.phone
            }
        )
        
        if request.method == 'POST':
            # Process form data
            user_profile.name = request.POST.get('user-name', '')
            user_profile.id_number = request.POST.get('id-number', '')
            user_profile.email = request.POST.get('email', '')
            user_profile.company = request.POST.get('company', '')
            user_profile.phone_number = request.POST.get('phone-number', '')
            user_profile.birthday = request.POST.get('birthday', '')
            user_profile.country = request.POST.get('country', '')
            user_profile.bio = request.POST.get('bio', '')
            
            # Save the updated profile
            user_profile.save()
            
            # Use the current path instead of named URL
            return redirect(request.path)
        
        # Provide the profile data to the template
        context = {
            'profile': user_profile,
        }
        return render(request, 'users/profile.html', context)
        
    except ShopUser.DoesNotExist:
        # Shop user not found, redirect to login
        return redirect('shop:shop_login')