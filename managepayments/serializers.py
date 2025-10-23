from rest_framework import serializers
from django.utils import timezone
# Import the Order model from the correct app
from managepayments.models import Order

class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['id', 'order_id', 'student_id', 'date', 'user_id']
        
    def create(self, validated_data):
        # Make sure the order has a date if not provided
        if 'date' not in validated_data:
            validated_data['date'] = timezone.now()
        return super().create(validated_data)