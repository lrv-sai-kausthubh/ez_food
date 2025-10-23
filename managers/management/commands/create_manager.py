from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from managers.models import ManagerProfile

class Command(BaseCommand):
    help = 'Create a canteen manager account'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)
        parser.add_argument('password', type=str)
        parser.add_argument('email', type=str)

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        email = options['email']
        
        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.ERROR(f'User with username "{username}" already exists'))
            return
            
        user = User.objects.create_user(username=username, email=email, password=password)
        ManagerProfile.objects.create(user=user)
        
        self.stdout.write(self.style.SUCCESS(f'Successfully created manager "{username}"'))