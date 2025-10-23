from django import forms
from .models import UserProfile

class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['name', 'id_number', 'email', 'company', 'phone_number', 'birthday', 'country', 'bio']