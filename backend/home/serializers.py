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


class PublicContentRecapSerializer(serializers.ModelSerializer):
    """API-1/2: public, approved-only Content Relay read model.

    Public users only see the safe summary plus source provenance. Internal
    operational fields are kept behind admin-only serializers.
    """

    title = serializers.CharField(source='suggested_title', read_only=True)
    summary = serializers.CharField(source='suggested_text', read_only=True)
    source_url = serializers.URLField(source='content_item.source_url', read_only=True)
    source_platform = serializers.CharField(source='content_item.source_platform', read_only=True)
    publisher = serializers.CharField(source='content_item.publisher', read_only=True)
    source_published_at = serializers.DateTimeField(source='content_item.published_at', read_only=True)
    fetched_at = serializers.DateTimeField(source='content_item.fetched_at', read_only=True)
    cluster_key = serializers.CharField(source='content_item.cluster_key', read_only=True)
    media_license_status = serializers.CharField(source='content_item.media_license_status', read_only=True)
    legal_media_urls = serializers.SerializerMethodField()

    class Meta:
        model = EditorialReview
        fields = [
            'id',
            'status',
            'title',
            'summary',
            'source_url',
            'source_platform',
            'publisher',
            'source_published_at',
            'fetched_at',
            'published_at',
            'cluster_key',
            'media_license_status',
            'legal_media_urls',
            'source_refs',
        ]
        read_only_fields = fields

    def get_legal_media_urls(self, obj):
        if obj.content_item.media_license_status != 'licensed':
            return []
        return obj.content_item.media_urls


class AdminContentReviewSerializer(serializers.ModelSerializer):
    """API-3: admin review queue with raw source context and audit fields."""

    source_url = serializers.URLField(source='content_item.source_url', read_only=True)
    source_platform = serializers.CharField(source='content_item.source_platform', read_only=True)
    publisher = serializers.CharField(source='content_item.publisher', read_only=True)
    source_published_at = serializers.DateTimeField(source='content_item.published_at', read_only=True)
    fetched_at = serializers.DateTimeField(source='content_item.fetched_at', read_only=True)
    raw_text = serializers.CharField(source='content_item.raw_text', read_only=True)
    normalized_text = serializers.CharField(source='content_item.normalized_text', read_only=True)
    content_hash = serializers.CharField(source='content_item.content_hash', read_only=True)
    cluster_key = serializers.CharField(source='content_item.cluster_key', read_only=True)
    media_license_status = serializers.CharField(source='content_item.media_license_status', read_only=True)

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
            'source_url',
            'source_platform',
            'publisher',
            'source_published_at',
            'fetched_at',
            'raw_text',
            'normalized_text',
            'content_hash',
            'cluster_key',
            'media_license_status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'created_at',
            'updated_at',
            'source_url',
            'source_platform',
            'publisher',
            'source_published_at',
            'fetched_at',
            'raw_text',
            'normalized_text',
            'content_hash',
            'cluster_key',
            'media_license_status',
        ]


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
            'proof_tx_hash',
            'proof_network',
            'proof_explorer_url',
            'proof_created_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'approved_at', 'proof_created_at']
