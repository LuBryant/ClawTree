from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import (
    UniversityEventViewSet,
    PublicUniversityEventViewSet,
    EventReviewViewSet,
    TweetReviewViewSet,
    OutreachDraftViewSet,
    PublicFeedView,
    PublicContentRecapViewSet,
    AdminSourceConnectorViewSet,
    AdminIngestionRunViewSet,
    AdminContentReviewViewSet,
    PipelineViewSet,
    WorkspaceViewSet,
    WorkspaceCapabilityViewSet,
)

router = DefaultRouter()
router.register(r'events', UniversityEventViewSet, basename='event')
router.register(r'user/events', PublicUniversityEventViewSet, basename='user-event')
router.register(r'user/recaps', PublicContentRecapViewSet, basename='user-recap')
router.register(r'reviews', EventReviewViewSet, basename='review')
router.register(r'tweet-reviews', TweetReviewViewSet, basename='tweet-review')
router.register(r'outreach', OutreachDraftViewSet, basename='outreach')
router.register(r'admin/source-connectors', AdminSourceConnectorViewSet, basename='admin-source-connector')
router.register(r'admin/ingestion-runs', AdminIngestionRunViewSet, basename='admin-ingestion-run')
router.register(r'admin/content-reviews', AdminContentReviewViewSet, basename='admin-content-review')
router.register(r'workspaces', WorkspaceViewSet, basename='workspace')
router.register(r'workspace-capabilities', WorkspaceCapabilityViewSet, basename='workspace-capability')

urlpatterns = [
    path('user/feed/', PublicFeedView.as_view(), name='user-feed'),
    path('', include(router.urls)),
    path('pipeline/', PipelineViewSet.as_view({'get': 'list'})),
    path('pipeline/configure/', PipelineViewSet.as_view({'post': 'configure'})),
    path('pipeline/trigger/', PipelineViewSet.as_view({'post': 'trigger'})),
    path('pipeline/stop/', PipelineViewSet.as_view({'post': 'stop'})),
]
