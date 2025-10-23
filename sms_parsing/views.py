from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.shortcuts import render
import json
from .sms_reader import process_sms_message

@csrf_exempt
@require_POST
def sms_webhook(request):
    """
    Webhook endpoint to receive SMS notifications from a service like Twilio
    
    Expected JSON format:
    {
        "From": "+1234567890",
        "Body": "Your payment of Rs.100 for order CMS-123456 is successful",
        "ReceivedAt": "2023-06-13T12:34:56Z" (optional)
    }
    """
    try:
        # Parse the incoming JSON
        data = json.loads(request.body)
        
        # Extract SMS details
        sender = data.get('From', 'Unknown')
        body = data.get('Body', '')
        received_at = data.get('ReceivedAt')
        
        # Process the SMS message
        result = process_sms_message(sender, body, received_at)
        
        # Return response
        return JsonResponse(result)
        
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "message": "Invalid JSON format"
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": f"Error processing request: {str(e)}"
        }, status=500)

@csrf_exempt
def test_sms(request):
    """Test endpoint for manual SMS processing"""
    if request.method == 'POST':
        sender = request.POST.get('sender', 'Test')
        body = request.POST.get('message', '')
        result = process_sms_message(sender, body)
        return JsonResponse(result)
    
    return render(request, 'sms_parsing/test_form.html')

