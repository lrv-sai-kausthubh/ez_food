from django.shortcuts import redirect
from functools import wraps

def manager_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check if user is logged in and is a manager
        if not request.user.is_authenticated or not request.session.get('is_manager'):
            return redirect('managers:login')
        return view_func(request, *args, **kwargs)
    return _wrapped_view