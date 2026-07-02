from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import UniversityEvent, EventReview, TweetReview
from .serializers import UniversityEventSerializer, EventReviewSerializer, TweetReviewSerializer
from .filters import UniversityEventFilter, EventReviewFilter, TweetReviewFilter


class UniversityEventViewSet(viewsets.ReadOnlyModelViewSet):
    """高校 AI/Web3 活动 API（只读）"""
    queryset = UniversityEvent.objects.all()
    serializer_class = UniversityEventSerializer
    filterset_class = UniversityEventFilter

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """活动统计摘要"""
        qs = UniversityEvent.objects
        return Response({
            'total': qs.count(),
            'by_category': {
                'AI': qs.filter(category='AI').count(),
                'Web3': qs.filter(category='Web3').count(),
                'AI+Web3': qs.filter(category='AI+Web3').count(),
            },
            'by_type': {
                '讲座': qs.filter(event_type='讲座').count(),
                '黑客松': qs.filter(event_type='黑客松').count(),
                '论坛': qs.filter(event_type='论坛').count(),
                '工作坊': qs.filter(event_type='工作坊').count(),
                '其他': qs.filter(event_type='其他').count(),
            },
            'contacted': qs.filter(is_contacted=True).count(),
            'uncontacted': qs.filter(is_contacted=False).count(),
        })


class EventReviewViewSet(viewsets.ModelViewSet):
    """活动回顾 API — 支持 CRUD"""
    queryset = EventReview.objects.all()
    serializer_class = EventReviewSerializer
    filterset_class = EventReviewFilter


class TweetReviewViewSet(viewsets.ReadOnlyModelViewSet):
    """推文回顾 API（只读）"""
    queryset = TweetReview.objects.filter(is_review_worthy=True)
    serializer_class = TweetReviewSerializer
    filterset_class = TweetReviewFilter
