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
    AdminCollaborationMatchViewSet,
    AdminProposalViewSet,
    PipelineViewSet,
    WorkspaceViewSet,
    WorkspaceCapabilityViewSet,
    UserAssistantChatView,
    UserCooperationLeadView,
    AdminOutreachBatchApproveView,
    AdminOutreachBatchSendView,
    AdminOutreachBatchStopView,
    AdminAgentRunViewSet,
    AdminAgentWorkflowViewSet,
    AdminIntelligenceViewSet,
    AdminAgentMetricsView,
    AdminAgentAlertEvaluateView,
    DemoCopilotView,
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
router.register(r'admin/matches', AdminCollaborationMatchViewSet, basename='admin-match')
router.register(r'admin/proposals', AdminProposalViewSet, basename='admin-proposal')
router.register(r'admin/agent-runs', AdminAgentRunViewSet, basename='admin-agent-run')
router.register(r'admin/agent-workflows', AdminAgentWorkflowViewSet, basename='admin-agent-workflow')
router.register(r'admin/intelligence', AdminIntelligenceViewSet, basename='admin-intelligence')
router.register(r'workspaces', WorkspaceViewSet, basename='workspace')
router.register(r'workspace-capabilities', WorkspaceCapabilityViewSet, basename='workspace-capability')

urlpatterns = [
    path('user/feed/', PublicFeedView.as_view(), name='user-feed'),
    path('user/assistant/chat/', UserAssistantChatView.as_view(), name='user-assistant-chat'),
    path('user/demo-copilot/', DemoCopilotView.as_view(), name='user-demo-copilot'),
    path('user/cooperation-leads/', UserCooperationLeadView.as_view(), name='user-cooperation-leads'),
    path('admin/outreach-batches/<int:pk>/approve/', AdminOutreachBatchApproveView.as_view(), name='admin-outreach-batch-approve'),
    path('admin/outreach-batches/<int:pk>/send/', AdminOutreachBatchSendView.as_view(), name='admin-outreach-batch-send'),
    path('admin/outreach-batches/<int:pk>/stop/', AdminOutreachBatchStopView.as_view(), name='admin-outreach-batch-stop'),
    path('admin/agent-metrics/', AdminAgentMetricsView.as_view(), name='admin-agent-metrics'),
    path('admin/agent-alerts/evaluate/', AdminAgentAlertEvaluateView.as_view(), name='admin-agent-alert-evaluate'),
    path('', include(router.urls)),
    path('pipeline/', PipelineViewSet.as_view({'get': 'list'})),
    path('pipeline/configure/', PipelineViewSet.as_view({'post': 'configure'})),
    path('pipeline/trigger/', PipelineViewSet.as_view({'post': 'trigger'})),
    path('pipeline/stop/', PipelineViewSet.as_view({'post': 'stop'})),
]
