from django.urls import path
from . import views

app_name = 'managers'

urlpatterns = [
    path('login/', views.manager_login, name='login'),
    path('logout/', views.manager_logout, name='logout'),
]