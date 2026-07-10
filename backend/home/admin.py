from django.contrib import admin
from .models import (
    UniversityEvent, EventReview, TweetReview, OutreachDraft,
    Workspace, BrandProfile, Capability,
)


admin.site.register(Workspace)
admin.site.register(BrandProfile)
admin.site.register(Capability)


@admin.register(UniversityEvent)
class UniversityEventAdmin(admin.ModelAdmin):
    list_display = [
        'workspace', 'title', 'university', 'category', 'event_type',
        'event_date', 'event_status', 'registration_status', 'source_tier', 'score',
        'verification_status', 'freshness_status', 'date_conflict', 'is_contacted', 'created_at',
    ]
    list_filter = [
        'workspace', 'category', 'event_type', 'event_status', 'registration_status',
        'source_tier', 'verification_status', 'freshness_status', 'date_conflict', 'is_contacted',
    ]
    search_fields = ['title', 'university', 'description', 'contact_email', 'contact_ai_email']
    ordering = ['-created_at']
    readonly_fields = [
        'score', 'officiality_score', 'completeness_score', 'freshness_score',
        'date_consistency_score', 'confidence_explanation', 'verification_queue_reasons',
        'verification_requested_at', 'verified_at', 'verified_by', 'created_at',
    ]
    actions = ['reassess_events', 'verify_events', 'reject_events']

    @admin.action(description='Recalculate radar confidence and verification queue')
    def reassess_events(self, request, queryset):
        for event in queryset:
            event.refresh_radar_assessment()
            event.save()

    @admin.action(description='Verify selected eligible events')
    def verify_events(self, request, queryset):
        verified = 0
        for event in queryset:
            try:
                event.mark_verified(reviewer=request.user.get_username() or 'django-admin')
                event.save()
                verified += 1
            except Exception:
                continue
        self.message_user(request, f'Verified {verified} eligible event(s).')

    @admin.action(description='Reject selected events')
    def reject_events(self, request, queryset):
        for event in queryset:
            event.mark_rejected(
                reviewer=request.user.get_username() or 'django-admin',
                note='Rejected from Django admin verification queue.',
            )
            event.save()


@admin.register(EventReview)
class EventReviewAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'title', 'source_type', 'published_at', 'created_at']
    list_filter = ['workspace', 'source_type']
    search_fields = ['title', 'content']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'tweet_id']


@admin.register(TweetReview)
class TweetReviewAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'tweet_id', 'is_review_worthy', 'is_sensitive', 'published_at', 'created_at']
    list_filter = ['workspace', 'is_review_worthy', 'is_sensitive']
    search_fields = ['text', 'summary']
    ordering = ['-published_at']
    readonly_fields = ['created_at', 'tweet_id']


@admin.register(OutreachDraft)
class OutreachDraftAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'university_event', 'status', 'recipient_email', 'approved_by', 'created_at']
    list_filter = ['workspace', 'status']
    search_fields = ['email_body', 'recipient_email']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
