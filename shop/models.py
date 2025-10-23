from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

class Order(models.Model):

    ORDER_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('successful', 'Successful'),
        ('cancelled', 'Cancelled'),
    ]


    order_id = models.CharField(max_length=50, unique=True)
    student_id = models.CharField(max_length=50)
    date_created = models.DateTimeField(default=timezone.now)
    name = models.CharField(max_length=100, blank=True, null=True)  # Add this field
    payment_method = models.CharField(max_length=20, blank=True, null=True)  # Add this field
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='pending')
    
    def __str__(self):
        return f"Order {self.order_id} by {self.student_id}"
    
    @property
    def total(self):
        return sum(item.price * item.quantity for item in self.items.all())
    
    class Meta:
        ordering = ['-date_created']

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    
    def __str__(self):
        return f"{self.quantity} x {self.name} in Order {self.order.order_id}"


class ShopUser(models.Model):
    name = models.CharField(max_length=100, unique=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    password = models.CharField(max_length=128, default='changeme')
    security_question1 = models.CharField(max_length=255, null=True, blank=True)
    security_answer1 = models.CharField(max_length=255, null=True, blank=True)
    security_question2 = models.CharField(max_length=255, null=True, blank=True)
    security_answer2 = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return self.name