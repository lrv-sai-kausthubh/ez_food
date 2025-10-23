from django.contrib import admin
from .models import DeliveryInfo

from .models import DeliveryStatus

admin.site.register(DeliveryInfo)


admin.site.register(DeliveryStatus)