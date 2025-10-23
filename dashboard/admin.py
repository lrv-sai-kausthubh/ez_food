from django.contrib import admin
from .models import InventoryItem

class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'quantity', 'category']
    search_fields = ['name', 'category']
    list_filter = ['category']

admin.site.register(InventoryItem, InventoryItemAdmin)