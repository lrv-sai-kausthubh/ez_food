from django.contrib import admin
from .models import UserProfile

class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'email', 'company', 'phone_number']
    search_fields = ['name', 'email', 'company']

admin.site.register(UserProfile, UserProfileAdmin)