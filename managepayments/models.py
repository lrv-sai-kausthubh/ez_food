from django.db import models

class Order(models.Model):
    order_id = models.CharField(max_length=20, unique=True)
    student_id = models.CharField(max_length=50)
    date = models.DateTimeField(auto_now_add=True)
    user_id = models.IntegerField(null=True, blank=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    payment_method = models.CharField(max_length=20, blank=True, null=True)
    
    def __str__(self):
        return f"Order {self.order_id} - {self.student_id}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    
    def __str__(self):
        return f"{self.quantity} x {self.name}"


class DeliveryInfo(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='delivery_info')
    floor_number = models.CharField(max_length=10)
    classroom = models.CharField(max_length=100)
    delivery_time = models.CharField(max_length=20)
    delivery_notes = models.TextField(blank=True, null=True)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=10.0)

    def __str__(self):
        return f"Delivery to {self.classroom} on floor {self.floor_number} at {self.delivery_time}"
    
    class Meta:
        verbose_name = "Delivery info"
        verbose_name_plural = "Delivery info"




class DeliveryStatus(models.Model):
    delivery_info = models.OneToOneField(DeliveryInfo, on_delete=models.CASCADE, related_name='status')
    is_successful = models.BooleanField(default=False)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivered_by = models.CharField(max_length=100, blank=True, null=True)
    delivery_notes = models.TextField(blank=True, null=True)
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_transit', 'In Transit'),
        ('delivered', 'Delivered'),
        ('failed', 'Failed'),
        ('returned', 'Returned'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    def __str__(self):
        status_text = "Successful" if self.is_successful else "Pending"
        return f"Delivery to {self.delivery_info.classroom} - {status_text}"
    
    class Meta:
        verbose_name = "Delivery status"
        verbose_name_plural = "Delivery status"