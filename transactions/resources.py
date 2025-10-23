from import_export import resources
from shop.models import Order

class TransactionResource(resources.ModelResource):
    class Meta:
        model = Order
        fields = ('order_id', 'student_id', 'name', 'date_created', 'payment_method')
        export_order = fields