from django.urls import path
from . import views

app_name = 'transactions'

urlpatterns = [
    path('', views.transactions_view, name='transactions'),
    path('api/list/', views.get_transactions, name='list_transactions'),
    path('api/details/<str:order_id>/', views.get_order_details, name='order_details'),
    path('api/export/', views.export_transactions, name='export_transactions'),
    path('api/update-status/<str:order_id>/', views.update_order_status, name='update_order_status'),


    # Add this new URL pattern
    path('delivery-view/', views.view_delivery_orders, name='view_delivery_orders'),
    
]