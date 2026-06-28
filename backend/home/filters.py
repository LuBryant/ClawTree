import django_filters
from .models import UniversityEvent


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
