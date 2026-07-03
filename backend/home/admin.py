from django.contrib import admin
from .models import UniversityEvent, EventReview, TweetReview, OutreachDraft


@admin.register(UniversityEvent)
class UniversityEventAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'university', 'category', 'event_type',
        'event_date', 'score', 'contact_email', 'contact_wechat', 'is_contacted', 'created_at',
    ]
    list_filter = ['category', 'event_type', 'is_contacted', 'university']
    search_fields = ['title', 'university', 'description', 'contact_email', 'contact_ai_email']
    ordering = ['-created_at']
    readonly_fields = ['created_at']


@admin.register(EventReview)
class EventReviewAdmin(admin.ModelAdmin):
    list_display = ['title', 'source_type', 'published_at', 'created_at']
    list_filter = ['source_type']
    search_fields = ['title', 'content']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'tweet_id']


@admin.register(TweetReview)
class TweetReviewAdmin(admin.ModelAdmin):
    list_display = ['tweet_id', 'is_review_worthy', 'is_sensitive', 'published_at', 'created_at']
    list_filter = ['is_review_worthy', 'is_sensitive']
    search_fields = ['text', 'summary']
    ordering = ['-published_at']
    readonly_fields = ['created_at', 'tweet_id']


@admin.register(OutreachDraft)
class OutreachDraftAdmin(admin.ModelAdmin):
    list_display = ['university_event', 'status', 'recipient_email', 'approved_by', 'created_at']
    list_filter = ['status']
    search_fields = ['email_body', 'recipient_email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
