"""
URL configuration for cafeteria_management_system project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

def redirect_to_shop(request):
    return redirect('shop/')

urlpatterns = [
    path('', redirect_to_shop),
    path('admin/', admin.site.urls),
    path('shop/', include('shop.urls')),
    path('users/', include(('users.urls', 'users'), namespace='users')),
    path('dashboard/', include(('dashboard.urls', 'dashboard'), namespace='dashboard')),
    path('shop/', include(('shop.urls', 'shop'), namespace='shop')),
    path('transactions/', include('transactions.urls')),
    path('managepayments/', include(('managepayments.urls', 'managepayments'), namespace='managepayments')),
    path('managers/', include('managers.urls')),
    # Add this to the existing urlpatterns list
    path('sms-parsing/', include('sms_parsing.urls')),
]