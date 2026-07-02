from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import UniversityEventViewSet, EventReviewViewSet, TweetReviewViewSet

router = DefaultRouter()
router.register(r'events', UniversityEventViewSet, basename='event')
router.register(r'reviews', EventReviewViewSet, basename='review')
router.register(r'tweet-reviews', TweetReviewViewSet, basename='tweet-review')

urlpatterns = [
    path('', include(router.urls)),
]
