from django.db import models
from django.contrib.auth.models import User

class ManagerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='manager_profile')
    
    def __str__(self):
        return f"Manager: {self.user.username}"