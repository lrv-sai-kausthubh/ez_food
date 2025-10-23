from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib import messages
from .models import ManagerProfile

def manager_login(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            
            # Check if user exists and is a manager
            if user and hasattr(user, 'manager_profile'):
                login(request, user)
                request.session['is_manager'] = True
                return redirect('dashboard:management')
            else:
                messages.error(request, "Invalid username or password, or user is not a manager.")
        else:
            messages.error(request, "Invalid username or password.")
    else:
        form = AuthenticationForm()
        
    return render(request, 'managers/manager.html', {'form': form})



def manager_logout(request):
    logout(request)
    if 'is_manager' in request.session:
        del request.session['is_manager']
    return redirect('managers:login')



from managers.decorators import manager_required

@manager_required
def management(request):
    """Dashboard view accessible only to managers"""
    return render(request, 'dashboard/management.html')

# Apply to all other dashboard views