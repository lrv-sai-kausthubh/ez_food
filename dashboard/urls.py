from django.urls import path
from . import views

urlpatterns = [
    path('management/', views.management, name='management'),
    path('api/items/', views.get_items, name='get_items'),
    path('api/items/add/', views.add_item, name='add_item'),
    path('api/items/<int:item_id>/delete/', views.delete_item, name='delete_item'),
    path('api/public-items/', views.get_public_items, name='get_public_items'),

    # Add this line to fix quantity updates:
    path('api/items/<int:item_id>/update/', views.update_item, name='update_item'),
]