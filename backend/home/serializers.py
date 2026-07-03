from rest_framework import serializers
from .models import (
    UniversityEvent,
    EventReview,
    TweetReview,
    SourceConnector,
    IngestionRun,
    ContentItem,
    EditorialReview,
    OutreachDraft,
)


class UniversityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityEvent
        fields = [
            'id',
            'title',
            'university',
            'event_date',
            'event_end_date',
            'location',
            'description',
            'source_url',
            'source_name',
            'contact_email',
            'contact_ai_email',
            'contact_phone',
            'contact_wechat',
            'contact_qq',
            'category',
            'event_type',
            'registration_url',
            'is_contacted',
            'score',
            'raw_data',
            'created_at',
        ]
        read_only_fields = ['created_at']


class EventReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventReview
        fields = [
            'id',
            'title',
            'content',
            'summary',
            'source_type',
            'source_url',
            'tweet_id',
            'published_at',
            'created_at',
        ]
        read_only_fields = ['created_at', 'tweet_id']


class TweetReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = TweetReview
        fields = [
            'id',
            'tweet_id',
            'text',
            'text_processed',
            'media_urls',
            'twitter_url',
            'summary',
            'is_review_worthy',
            'is_sensitive',
            'published_at',
            'created_at',
        ]
        read_only_fields = ['created_at']


class SourceConnectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceConnector
        fields = [
            'id',
            'name',
            'platform',
            'account_or_site',
            'auth_mode',
            'frequency',
            'cursor',
            'daily_budget_cents',
            'status',
            'owner',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class IngestionRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = IngestionRun
        fields = [
            'id',
            'connector',
            'status',
            'scheduled_at',
            'started_at',
            'finished_at',
            'cursor_before',
            'cursor_after',
            'collected_count',
            'new_count',
            'duplicate_count',
            'failed_count',
            'duration_ms',
            'model_cost_cents',
            'retry_count',
            'error_code',
            'error_message',
            'created_at',
        ]
        read_only_fields = ['created_at']


class ContentItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentItem
        fields = [
            'id',
            'connector',
            'ingestion_run',
            'source_platform',
            'source_url',
            'external_id',
            'publisher',
            'published_at',
            'fetched_at',
            'normalized_text',
            'content_hash',
            'cluster_key',
            'topic_scores',
            'media_urls',
            'media_license_status',
            'created_at',
        ]
        read_only_fields = ['created_at']


class EditorialReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = EditorialReview
        fields = [
            'id',
            'content_item',
            'status',
            'classification',
            'risk_labels',
            'suggested_title',
            'suggested_text',
            'diff_summary',
            'source_refs',
            'model_version',
            'reviewer',
            'reviewed_at',
            'published_at',
            'rejection_reason',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class OutreachDraftSerializer(serializers.ModelSerializer):
    university_name = serializers.CharField(source='university_event.university', read_only=True)
    event_title = serializers.CharField(source='university_event.title', read_only=True)

    class Meta:
        model = OutreachDraft
        fields = [
            'id',
            'university_event',
            'university_name',
            'event_title',
            'subject',
            'email_body',
            'recipient_email',
            'status',
            'approved_by',
            'approved_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'approved_at']
