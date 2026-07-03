from rest_framework import serializers
from .models import (
    UniversityEvent,
    EventReview,
    TweetReview,
    SourceConnector,
    IngestionRun,
    ContentItem,
    EditorialReview,
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
            'category',
            'event_type',
            'registration_url',
            'is_contacted',
            'score',
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
