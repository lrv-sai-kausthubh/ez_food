from django import forms
from .models import ShopUser

class LoginForm(forms.Form):
    name = forms.CharField(max_length=100)
    password = forms.CharField(widget=forms.PasswordInput())

class RegisterForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput())

    def clean_name(self):
        name = self.cleaned_data['name']
        # Check if a user with this name already exists (case-insensitive)
        if ShopUser.objects.filter(name__iexact=name).exists():
            raise forms.ValidationError("This username is already taken. Please choose a different one.")
        return name

    # Define common security questions as choices
    SECURITY_QUESTIONS = [
        ('', 'Select a security question'),
        ('What was your childhood nickname?', 'What was your childhood nickname?'),
        ('What is your favorite movie?', 'What is your favorite movie?'),
        ('What was the name of your first pet?', 'What was the name of your first pet?'),
        ('What is your mother\'s maiden name?', 'What is your mother\'s maiden name?'),
        ('What high school did you attend?', 'What high school did you attend?'),
    ]
    
    security_question1 = forms.ChoiceField(choices=SECURITY_QUESTIONS, required=True)
    security_answer1 = forms.CharField(max_length=255, required=True)
    security_question2 = forms.ChoiceField(choices=SECURITY_QUESTIONS, required=False)
    security_answer2 = forms.CharField(max_length=255, required=False)

    class Meta:
        model = ShopUser
        fields = ['name', 'email', 'phone', 'password', 'security_question1', 'security_answer1', 
                 'security_question2', 'security_answer2']
        

# Add these new forms
class ForgotPasswordForm(forms.Form):
    name = forms.CharField(max_length=100)

class SecurityAnswerForm(forms.Form):
    answer = forms.CharField(max_length=255)

class PasswordResetForm(forms.Form):
    new_password = forms.CharField(widget=forms.PasswordInput())
    confirm_password = forms.CharField(widget=forms.PasswordInput())
    
    def clean(self):
        cleaned_data = super().clean()
        new_password = cleaned_data.get('new_password')
        confirm_password = cleaned_data.get('confirm_password')
        
        if new_password and confirm_password and new_password != confirm_password:
            raise forms.ValidationError("Passwords don't match")
        
        return cleaned_data