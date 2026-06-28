from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import UniversityEventViewSet

router = DefaultRouter()
router.register(r'events', UniversityEventViewSet, basename='event')

urlpatterns = [
    path('', include(router.urls)),
]
