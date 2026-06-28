from django.contrib import admin
from .models import UniversityEvent


@admin.register(UniversityEvent)
class UniversityEventAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'university', 'category', 'event_type',
        'event_date', 'score', 'is_contacted', 'created_at',
    ]
    list_filter = ['category', 'event_type', 'is_contacted', 'university']
    search_fields = ['title', 'university', 'description', 'contact_email']
    ordering = ['-created_at']
    readonly_fields = ['created_at']
