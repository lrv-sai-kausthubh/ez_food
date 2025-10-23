from django.shortcuts import render
from django.http import JsonResponse
from .models import InventoryItem
import json
from django.views.decorators.csrf import csrf_exempt
from managers.decorators import manager_required

@manager_required
def management(request):
    return render(request, 'dashboard/management.html')

# API endpoints
@manager_required
def get_items(request):
    items = list(InventoryItem.objects.values())
    return JsonResponse({'items': items})


# Add this new public endpoint for the shop
def get_public_items(request):
    """Public endpoint for accessing inventory data (read-only)"""
    items = list(InventoryItem.objects.values('id', 'name', 'quantity', 'category'))
    return JsonResponse({'items': items})


@manager_required
def add_item(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            item = InventoryItem.objects.create(
                name=data['name'],
                quantity=data['quantity'],
                category=data['category'],
                # Remove product_id and price
            )
            return JsonResponse({
                'success': True,
                'id': item.id,  # Make sure to include item.id
                'name': item.name,
                'quantity': item.quantity,
                'category': item.category,
                # Remove product_id and price
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Invalid request method'})

@csrf_exempt
def delete_item(request, item_id):
    if request.method == 'DELETE':
        try:
            item = InventoryItem.objects.get(id=item_id)
            item.delete()
            return JsonResponse({'success': True})
        except InventoryItem.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Item not found'})
    return JsonResponse({'success': False})

@csrf_exempt
def update_item(request, item_id):
    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            item = InventoryItem.objects.get(id=item_id)
            item.name = data.get('name', item.name)
            item.quantity = data.get('quantity', item.quantity)
            item.category = data.get('category', item.category)
            item.save()
            return JsonResponse({
                'success': True,
                'id': item.id,
                'name': item.name,
                'quantity': item.quantity,
                'category': item.category
            })
        except InventoryItem.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Item not found'})
    return JsonResponse({'success': False})
    