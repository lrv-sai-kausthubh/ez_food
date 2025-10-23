from django.urls import path
from . import views

app_name = 'managepayments'

urlpatterns = [
    path('checkout/', views.checkout_view, name='checkout'),
    path('process_payment/', views.process_payment, name='process_payment'),
    path('confirmation/', views.payment_confirmation, name='confirmation'),
    path('api/update-inventory/', views.update_inventory, name='update_inventory'),
    path('api/get-order-history/', views.get_order_history, name='get_order_history'),
    path('download-receipt/', views.download_receipt, name='download_receipt'),

    # New URLs for mock Razorpay
    path('create-payment/', views.create_mock_payment, name='create_payment'),
    path('payment-callback/', views.payment_callback, name='payment_callback'),
    path('mock-razorpay/', views.show_mock_razorpay, name='show_mock_razorpay'),


    # Add the new UPI payment URL
    path('upi-payment/', views.show_upi_payment, name='show_upi_payment'),
    path('process-upi-payment/', views.process_upi_payment, name='process_upi_payment'),

    path('deliver-to-class/', views.deliver_to_class_view, name='deliver_to_class'),
    path('process-delivery/', views.process_delivery_view, name='process_delivery'),
]