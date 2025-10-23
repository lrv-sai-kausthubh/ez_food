from django.contrib import admin
from .models import Order, OrderItem, ShopUser

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_id', 'student_id', 'date_created', 'total']
    search_fields = ['order_id', 'student_id']
    inlines = [OrderItemInline]


@admin.register(ShopUser)
class ShopUserAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'phone']
    search_fields = ['name', 'email', 'phone']

# No need to register OrderItem separately as it's managed through the inline