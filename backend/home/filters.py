import django_filters
from django.db import models
from .models import UniversityEvent, EventReview, TweetReview


class UniversityEventFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(lookup_expr='exact')
    event_type = django_filters.CharFilter(lookup_expr='exact')
    university = django_filters.CharFilter(lookup_expr='icontains')
    is_contacted = django_filters.BooleanFilter()
    score_min = django_filters.NumberFilter(field_name='score', lookup_expr='gte')
    event_date_from = django_filters.DateFilter(field_name='event_date', lookup_expr='gte')
    event_date_to = django_filters.DateFilter(field_name='event_date', lookup_expr='lte')

    class Meta:
        model = UniversityEvent
        fields = [
            'category', 'event_type', 'university',
            'is_contacted', 'score_min',
            'event_date_from', 'event_date_to',
        ]


class EventReviewFilter(django_filters.FilterSet):
    source_type = django_filters.CharFilter(lookup_expr='exact')
    search = django_filters.CharFilter(method='filter_search')

    class Meta:
        model = EventReview
        fields = ['source_type']

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            models.Q(title__icontains=value) | models.Q(content__icontains=value)
        )


class TweetReviewFilter(django_filters.FilterSet):
    is_review_worthy = django_filters.BooleanFilter()
    search = django_filters.CharFilter(method='filter_search')

    class Meta:
        model = TweetReview
        fields = ['is_review_worthy']

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            models.Q(text__icontains=value) | models.Q(summary__icontains=value)
        )
