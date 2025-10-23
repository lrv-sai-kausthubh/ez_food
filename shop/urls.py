from django.urls import path
from . import views
from django.conf.urls.static import static
from django.conf import settings
from django.urls import include

urlpatterns = [
    path('', views.cafe, name='cafe'),
    path('api/save-order/', views.save_order, name='save_order'),
    path('api/get-order-history/', views.get_order_history, name='get_order_history'),
    path('login/', views.login_view, name='shop_login'),
    path('register/', views.register_view, name='shop_register'),
    path('logout/', views.logout_view, name='shop_logout'),
    path('history/', views.order_history_view, name='history'),
    path('forgot-password/', views.forgot_password, name='forgot_password'),
    path('security-questions/', views.security_questions, name='security_questions'),
    path('reset-password/', views.reset_password, name='reset_password'),
    path('order-history/', views.order_history_view, name='order_history'),
    # Add this new URL for the chatbot
    path('userhelp/', views.userhelp_view, name='userhelp'),

    path('about/', views.about_us, name='about_us'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)