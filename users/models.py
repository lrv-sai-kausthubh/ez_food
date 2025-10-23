from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse

class UserProfile(models.Model):
    # Keep the Django user field optional
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    # Add shop_user_id field
    shop_user_id = models.IntegerField(null=True, blank=True)
    
    # Profile fields
    name = models.CharField(max_length=100, blank=True)
    id_number = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    company = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    birthday = models.CharField(max_length=50, blank=True)
    country = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    
    def __str__(self):
        return self.name or "Profile"