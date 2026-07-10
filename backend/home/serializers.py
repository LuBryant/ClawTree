from rest_framework import serializers
from .models import (
    UniversityEvent,
    Workspace,
    BrandProfile,
    Capability,
    EventReview,
    TweetReview,
    SourceConnector,
    IngestionRun,
    ContentItem,
    EditorialReview,
    OutreachDraft,
    ContactPoint,
    CollaborationMatch,
    Proposal,
    OutreachBatch,
    OutreachMessage,
    AgentRun,
    PipelineRun,
    PipelineConfig,
)


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ['id', 'slug', 'name', 'name_en', 'industries', 'is_reference_case', 'is_active', 'created_at', 'updated_at']
        read_only_fields = fields


class BrandProfileSerializer(serializers.ModelSerializer):
    workspace_slug = serializers.CharField(source='workspace.slug', read_only=True)

    class Meta:
        model = BrandProfile
        fields = ['workspace_slug', 'mission', 'mission_en', 'outreach_signature', 'outreach_signature_en', 'guardrails', 'updated_at']
        read_only_fields = fields


class CapabilitySerializer(serializers.ModelSerializer):
    workspace_slug = serializers.CharField(source='workspace.slug', read_only=True)

    class Meta:
        model = Capability
        fields = ['id', 'workspace_slug', 'code', 'title', 'title_en', 'source_ids', 'owner', 'valid_until', 'approved', 'boundary', 'boundary_en']
        read_only_fields = fields


class UniversityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityEvent
        fields = [
            'id',
            'workspace',
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
            'created_at',
        ]
        read_only_fields = ['created_at']


class AdminUniversityEventSerializer(UniversityEventSerializer):
    class Meta(UniversityEventSerializer.Meta):
        fields = [
            *UniversityEventSerializer.Meta.fields,
            'contact_email',
            'contact_ai_email',
            'contact_phone',
            'contact_wechat',
            'contact_qq',
            'is_contacted',
            'score',
        ]


class EventReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventReview
        fields = [
            'id',
            'workspace',
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
            'workspace',
            'tweet_id',
            'text',
            'text_processed',
            'media_urls',
            'twitter_url',
            'space_url',
            'space_summary',
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
            'workspace',
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
    workspace_slug = serializers.CharField(source='connector.workspace.slug', read_only=True)

    class Meta:
        model = IngestionRun
        fields = [
            'id',
            'workspace_slug',
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
            'workspace',
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
    workspace_slug = serializers.CharField(source='content_item.workspace.slug', read_only=True)

    class Meta:
        model = EditorialReview
        fields = [
            'id',
            'workspace_slug',
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
            'workspace',
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


class ContactPointSerializer(serializers.ModelSerializer):
    """Admin-only contact serializer; public event serializers never nest it."""

    is_usable_for_live_outreach = serializers.BooleanField(read_only=True)

    class Meta:
        model = ContactPoint
        fields = [
            'id', 'university_event', 'channel', 'value', 'purpose', 'evidence_url',
            'first_verified_at', 'last_verified_at', 'confidence', 'verification_status',
            'is_public_business_contact', 'is_mock', 'is_usable_for_live_outreach',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_usable_for_live_outreach']


AdminContactPointSerializer = ContactPointSerializer


class CollaborationMatchSerializer(serializers.ModelSerializer):
    university_name = serializers.CharField(source='event.university', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)

    class Meta:
        model = CollaborationMatch
        fields = [
            'id', 'workspace', 'event', 'university_name', 'event_title', 'campaign_key', 'status',
            'overall_score', 'theme_score', 'audience_score', 'timing_score', 'city_score',
            'resource_score', 'information_score', 'fit_points', 'missing_information',
            'conflicts', 'citations', 'score_citations', 'scoring_version', 'model_version',
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class ProposalSerializer(serializers.ModelSerializer):
    event = serializers.PrimaryKeyRelatedField(source='match.event', read_only=True)
    campaign_key = serializers.CharField(source='match.campaign_key', read_only=True)

    class Meta:
        model = Proposal
        fields = [
            'id', 'match', 'event', 'campaign_key', 'version', 'previous_version', 'status',
            'packages', 'partner_value', 'workspace_value', 'resources', 'pending_questions',
            'risks', 'source_refs', 'evidence', 'guardrail_checks', 'edit_summary', 'edited_by',
            'approved_by', 'approved_at', 'rejection_reason', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class OutreachBatchSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source='messages.count', read_only=True)

    class Meta:
        model = OutreachBatch
        fields = [
            'id', 'workspace', 'name', 'selection_criteria', 'target_count', 'message_count',
            'rate_limit_per_hour', 'daily_limit', 'status', 'created_by', 'approved_by',
            'approved_at', 'scheduled_at', 'stop_requested', 'stop_reason', 'created_at', 'updated_at',
        ]
        read_only_fields = ['message_count', 'created_at', 'updated_at']


class OutreachMessageSerializer(serializers.ModelSerializer):
    university_name = serializers.CharField(source='university_event.university', read_only=True)

    class Meta:
        model = OutreachMessage
        fields = [
            'id', 'batch', 'university_event', 'university_name', 'proposal', 'proposal_version',
            'contact_point', 'contact_evidence_url', 'contact_verified_at', 'idempotency_key',
            'subject', 'body', 'personalization', 'citation_ids', 'guardrail_checks', 'status',
            'approved_by', 'approved_at', 'provider', 'provider_status', 'provider_message_id',
            'provider_error_code', 'provider_error_message', 'retry_count', 'next_retry_at',
            'sent_at', 'bounced_at', 'unsubscribed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'provider_status', 'provider_message_id', 'provider_error_code', 'provider_error_message',
            'retry_count', 'sent_at', 'bounced_at', 'unsubscribed_at', 'created_at', 'updated_at',
        ]


class AgentRunSerializer(serializers.ModelSerializer):
    total_tokens = serializers.IntegerField(read_only=True)

    class Meta:
        model = AgentRun
        fields = [
            'run_id', 'workspace', 'task_type', 'status', 'model_provider', 'model_name',
            'model_version', 'schema_name', 'schema_version', 'prompt_version', 'input_references',
            'citations', 'input_snapshot', 'structured_output', 'tool_calls', 'input_tokens',
            'output_tokens', 'cached_input_tokens', 'total_tokens', 'latency_ms', 'cost_microusd',
            'retry_count', 'cache_hit', 'privacy_status', 'redacted_fields', 'error_code',
            'error_message', 'human_feedback', 'feedback_by', 'feedback_at', 'started_at',
            'finished_at', 'created_at',
        ]
        read_only_fields = fields


class PipelineRunSerializer(serializers.ModelSerializer):
    step_label = serializers.CharField(source='get_step_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PipelineRun
        fields = [
            'id', 'workspace', 'step', 'step_label', 'status', 'status_label', 'stop_requested',
            'collected', 'added', 'skipped', 'failed', 'duration_ms',
            'error_message', 'started_at', 'finished_at', 'created_at',
        ]
        read_only_fields = fields


class PipelineConfigSerializer(serializers.ModelSerializer):
    step_label = serializers.CharField(source='get_step_display', read_only=True)

    class Meta:
        model = PipelineConfig
        fields = ['id', 'workspace', 'step', 'step_label', 'enabled', 'schedule_time', 'max_count', 'updated_at']
