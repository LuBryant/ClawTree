import os
import json
import time
import subprocess
import sys
import requests
import hashlib
from datetime import datetime

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from openai import OpenAI

from .models import (
    Workspace,
    BrandProfile,
    Capability,
    UniversityEvent,
    EventReview,
    TweetReview,
    OutreachDraft,
    SourceConnector,
    IngestionRun,
    EditorialReview,
    OutreachBatch,
    OutreachMessage,
)
from .serializers import (
    WorkspaceSerializer,
    BrandProfileSerializer,
    CapabilitySerializer,
    UniversityEventSerializer,
    AdminUniversityEventSerializer,
    EventReviewSerializer,
    TweetReviewSerializer,
    OutreachDraftSerializer,
    SourceConnectorSerializer,
    IngestionRunSerializer,
    PublicContentRecapSerializer,
    AdminContentReviewSerializer,
)
from .models import UniversityEvent, EventReview, TweetReview, OutreachDraft, PipelineRun, PipelineConfig
from .serializers import UniversityEventSerializer, EventReviewSerializer, TweetReviewSerializer, OutreachDraftSerializer
from .filters import UniversityEventFilter, EventReviewFilter, TweetReviewFilter
from .api_contracts import (
    claim_idempotency,
    error_response,
    input_version,
    require_mutation_contract,
    request_operator,
    success_response,
)


def _init_llm():
    """初始化 LLM 客户端 — 优先 DeepSeek，否则 OpenAI"""
    key = os.environ.get('DEEPSEEK_API_KEY')
    if key:
        return OpenAI(api_key=key, base_url='https://api.deepseek.com'), 'deepseek-chat'
    key = os.environ.get('OPENAI_API_KEY')
    if key:
        base = os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1')
        model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        return OpenAI(api_key=key, base_url=base), model
    return None, None


DEFAULT_WORKSPACE_SLUG = 'treefinance'


def _workspace_slug(request):
    return (
        request.headers.get('X-ClawTree-Workspace')
        or request.query_params.get('workspace')
        or (request.data.get('workspace_slug') if hasattr(request.data, 'get') else None)
        or DEFAULT_WORKSPACE_SLUG
    )


def _active_workspace(request):
    return get_object_or_404(Workspace, slug=_workspace_slug(request), is_active=True)


class WorkspaceScopedQuerysetMixin:
    workspace_filter = 'workspace__slug'

    def get_workspace(self):
        return _active_workspace(self.request)

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(**{self.workspace_filter: _workspace_slug(self.request)})


EMAIL_SYSTEM_PROMPT = (
    '你是 ClawTree 工作区的专业合作邮件撰写 Agent。只能使用当前工作区提供的已审核品牌档案和能力证据，'
    '撰写个性化合作邀请邮件。风格专业、真诚、简洁；不得替工作区承诺未审核资源。'
)

EMAIL_PROMPT_TEMPLATE = """请为以下高校活动撰写一封 {brand_name} 的合作邀请邮件。

当前工作区：
- 名称：{brand_name}
- 使命：{mission}
- 已审核能力：{capabilities}
- 约束：只能引用上述能力；具体资源、嘉宾、时间和权益仍需人工确认

活动信息：
- 高校：{university}
- 活动：{title}
- 日期：{date}
- 类型：{event_type}
- 简介：{description}

邮件要求：
1. 称呼对方为"{university} 老师"（如无法确定具体联系人）
2. 提及对该校活动的了解和欣赏
3. 提出 2-3 个具体合作方向，结合该活动的特点
4. 署名"{signature}"
5. 语气真诚、有温度，不要过度营销

请只返回邮件正文（纯文本），不要包含其他解释。"""


def _error(code, detail, http_status=status.HTTP_400_BAD_REQUEST, audit_id=''):
    return Response({
        'error': {'code': code, 'detail': detail},
        'audit_id': audit_id,
        'externalSideEffect': False,
    }, status=http_status)


def _operator(request):
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        return user.get_username()
    return request.data.get('operator') or request.data.get('reviewer') or 'admin'


def _audit_id(request, prefix):
    key = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key') or ''
    return f'{prefix}:{key}' if key else f'{prefix}:{timezone.now().strftime("%Y%m%d%H%M%S")}'


class WorkspaceViewSet(viewsets.ReadOnlyModelViewSet):
    """Public workspace directory; private operational data is never serialized here."""

    queryset = Workspace.objects.filter(is_active=True).prefetch_related('capabilities')
    serializer_class = WorkspaceSerializer
    lookup_field = 'slug'
    search_fields = ['name', 'name_en', 'slug']


class WorkspaceCapabilityViewSet(viewsets.ReadOnlyModelViewSet):
    """Reviewed public capabilities for one active workspace."""

    serializer_class = CapabilitySerializer

    def get_queryset(self):
        return Capability.objects.select_related('workspace').filter(
            workspace__slug=_workspace_slug(self.request),
            workspace__is_active=True,
            approved=True,
        )


class PublicFeedView(APIView):
    """API-2: compact public feed envelope for /user.

    It intentionally contains no internal scores, raw source text, contacts, or
    model prompts. The response is safe to proxy from the frontend.
    """

    def get(self, request):
        recaps = EditorialReview.objects.select_related('content_item').filter(
            status='published',
            content_item__workspace__slug=_workspace_slug(request),
        ).order_by('-published_at', '-updated_at')[:6]
        return Response({
            'externalSideEffect': False,
            'recaps': PublicContentRecapSerializer(recaps, many=True).data,
        })


def _client_key(request, scope):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
    address = forwarded or request.META.get('REMOTE_ADDR', 'unknown')
    digest = hashlib.sha256(address.encode('utf-8')).hexdigest()[:24]
    return f'clawtree:{scope}:{digest}'


def _rate_limited(request, scope, limit, window_seconds=60):
    """Small cache-backed fixed-window limiter for public endpoints."""
    key = _client_key(request, scope)
    if cache.add(key, 1, timeout=window_seconds):
        return False
    try:
        return cache.incr(key) > limit
    except ValueError:
        cache.set(key, 1, timeout=window_seconds)
        return False


class UserAssistantChatView(APIView):
    """API-6: bounded, rate-limited assistant with a safe local fallback."""

    MAX_MESSAGES = 20
    MAX_MESSAGE_CHARS = 4000
    MAX_TOTAL_CHARS = 20000

    def post(self, request):
        if _rate_limited(request, 'assistant-chat', 10):
            return _error('rate_limited', 'Too many chat requests. Please retry in one minute.', status.HTTP_429_TOO_MANY_REQUESTS)
        messages = request.data.get('messages')
        if not isinstance(messages, list) or not messages or len(messages) > self.MAX_MESSAGES:
            return _error('invalid_messages', 'messages must be a non-empty bounded list.')
        total = 0
        for message in messages:
            if not isinstance(message, dict) or message.get('role') not in ('user', 'assistant'):
                return _error('invalid_messages', 'Only user and assistant roles are accepted.')
            content = message.get('content')
            if not isinstance(content, str) or not content.strip() or len(content) > self.MAX_MESSAGE_CHARS:
                return _error('invalid_messages', 'Each message must contain bounded text.')
            total += len(content)
        if total > self.MAX_TOTAL_CHARS or messages[-1].get('role') != 'user':
            return _error('invalid_messages', 'Conversation is too large or does not end with a user message.')

        question = messages[-1]['content'].strip()
        handoff_terms = ('人工', '客服', '合作', '联系', '报价', 'human', 'agent', 'contact', 'partnership')
        handoff_required = any(term in question.lower() for term in handoff_terms)
        workspace = _active_workspace(request)
        if handoff_required:
            answer = '我可以帮你转交人工团队。提交联系信息前，请先确认你同意我们仅将其用于本次合作跟进。'
            reason = 'user_requested_or_commercial_follow_up'
        else:
            answer = (
                f'我是 {workspace.name} 的安全客服助手。目前模型服务未启用，我不会猜测未经审核的信息。'
                '你可以询问公开活动与合作方式；需要具体承诺时，我会建议转人工确认。'
            )
            reason = ''
        return Response({
            'answer': answer,
            'mode': 'safe_fallback',
            'grounded': False,
            'citations': [],
            'handoff': {
                'required': handoff_required,
                'reason': reason,
                'url': '/user/cooperate',
            },
            'externalSideEffect': False,
        })


class UserCooperationLeadView(APIView):
    """API-6: consent-gated handoff intake; defaults to simulation/no delivery."""

    def post(self, request):
        action_name = 'cooperation-lead-create'
        contract_error = require_mutation_contract(request, action_name)
        if contract_error:
            return contract_error
        idempotency_error = claim_idempotency(request, action_name)
        if idempotency_error:
            return idempotency_error
        if _rate_limited(request, 'cooperation-lead', 5, 300):
            return error_response(request, action_name, 'rate_limited', 'Too many lead submissions. Please retry later.', http_status=status.HTTP_429_TOO_MANY_REQUESTS)
        if request.data.get('website'):
            return error_response(request, action_name, 'abuse_detected', 'Submission rejected.')
        if request.data.get('consent') is not True:
            return error_response(request, action_name, 'consent_required', 'Explicit consent is required before collecting contact information.')
        name = str(request.data.get('name', '')).strip()
        contact = str(request.data.get('contact', '')).strip()
        intent = str(request.data.get('intent', '')).strip()
        if not name or not contact or not intent or max(len(name), len(contact)) > 200 or len(intent) > 2000:
            return error_response(request, action_name, 'invalid_lead', 'name, contact, and a bounded intent are required.')
        return success_response(request, action_name, {
            'status': 'accepted_for_human_review',
            'handoff': True,
            'retentionPurpose': '合作申请人工跟进',
        }, http_status=status.HTTP_202_ACCEPTED)


class AdminOutreachBatchApproveView(APIView):
    """API-5: human approval of rate, daily cap, and optional schedule."""

    @transaction.atomic
    def post(self, request, pk):
        action_name = f'outreach-batch-{pk}-approve'
        contract_error = require_mutation_contract(request, action_name)
        if contract_error:
            return contract_error
        idempotency_error = claim_idempotency(request, action_name)
        if idempotency_error:
            return idempotency_error
        batch = get_object_or_404(OutreachBatch.objects.select_for_update(), pk=pk, workspace=_active_workspace(request))
        if batch.status not in ('draft', 'awaiting_approval'):
            return error_response(request, action_name, 'invalid_batch_state', 'Only draft or awaiting-approval batches can be approved.', http_status=status.HTTP_409_CONFLICT)
        operator = request_operator(request)
        if not operator or operator in ('admin', 'anonymous'):
            return error_response(request, action_name, 'named_approver_required', 'A named human approver is required.')
        try:
            rate = int(request.data.get('rate_limit_per_hour', batch.rate_limit_per_hour))
            daily = int(request.data.get('daily_limit', batch.daily_limit))
        except (TypeError, ValueError):
            return error_response(request, action_name, 'invalid_limits', 'Rate and daily limits must be integers.')
        if rate < 1 or daily < 1:
            return error_response(request, action_name, 'invalid_limits', 'Rate and daily limits must be positive.')
        batch.rate_limit_per_hour = rate
        batch.daily_limit = daily
        batch.approved_by = operator
        batch.approved_at = timezone.now()
        if batch.status == 'draft':
            batch.transition_to('awaiting_approval')
            batch.save()
        batch.transition_to('approved')
        batch.save()
        return success_response(request, action_name, {
            'id': batch.id, 'status': batch.status, 'approved_by': batch.approved_by,
            'rate_limit_per_hour': rate, 'daily_limit': daily,
        })


class AdminOutreachBatchSendView(APIView):
    """API-5: fail-closed dispatch gate; simulation is the immutable default."""

    @transaction.atomic
    def post(self, request, pk):
        action_name = f'outreach-batch-{pk}-send'
        contract_error = require_mutation_contract(request, action_name)
        if contract_error:
            return contract_error
        idempotency_error = claim_idempotency(request, action_name)
        if idempotency_error:
            return idempotency_error
        batch = get_object_or_404(OutreachBatch.objects.select_for_update(), pk=pk, workspace=_active_workspace(request))
        if batch.stop_requested or batch.status == 'stopped':
            return error_response(request, action_name, 'emergency_stop_active', 'Dispatch is disabled by the emergency stop.', http_status=status.HTTP_409_CONFLICT)
        approved_states = ('approved', 'scheduled', 'running')
        if batch.status not in approved_states or not batch.approved_by or not batch.approved_at:
            return success_response(request, action_name, {
                'batch_id': batch.id, 'status': batch.status, 'sent_count': 0,
                'eligible_count': 0, 'blocked_reason': 'batch_not_approved', 'simulation': True,
            })
        eligible = OutreachMessage.objects.filter(
            batch=batch, status='approved', unsubscribed_at__isnull=True,
        ).exclude(provider_status__in=('unsubscribed', 'complained')).count()
        # Live delivery deliberately requires a separately implemented provider
        # adapter. This endpoint never calls SMTP or a network service.
        return success_response(request, action_name, {
            'batch_id': batch.id, 'status': batch.status, 'sent_count': 0,
            'eligible_count': min(eligible, batch.daily_limit),
            'blocked_count': batch.messages.count() - eligible,
            'simulation': True,
        })


class AdminOutreachBatchStopView(APIView):
    """API-5: immediate persistent kill switch for a batch."""

    @transaction.atomic
    def post(self, request, pk):
        action_name = f'outreach-batch-{pk}-stop'
        contract_error = require_mutation_contract(request, action_name)
        if contract_error:
            return contract_error
        idempotency_error = claim_idempotency(request, action_name)
        if idempotency_error:
            return idempotency_error
        batch = get_object_or_404(OutreachBatch.objects.select_for_update(), pk=pk, workspace=_active_workspace(request))
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            return error_response(request, action_name, 'stop_reason_required', 'Emergency stop requires an audit reason.')
        if batch.status == 'completed':
            return error_response(request, action_name, 'invalid_batch_state', 'A completed batch cannot be stopped.', http_status=status.HTTP_409_CONFLICT)
        batch.stop_requested = True
        batch.stop_reason = reason
        if batch.status != 'stopped':
            batch.transition_to('stopped')
        batch.save()
        cancelled = batch.messages.filter(status__in=('approved', 'queued')).update(status='cancelled')
        return success_response(request, action_name, {
            'id': batch.id, 'status': batch.status, 'stop_requested': True,
            'cancelled_count': cancelled,
        })


class PublicContentRecapViewSet(WorkspaceScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Published Content Relay recaps for teachers and students."""

    serializer_class = PublicContentRecapSerializer
    search_fields = ['suggested_title', 'suggested_text', 'content_item__publisher']
    ordering_fields = ['published_at', 'updated_at', 'content_item__published_at']
    ordering = ['-published_at', '-updated_at']
    workspace_filter = 'content_item__workspace__slug'

    def get_queryset(self):
        return EditorialReview.objects.select_related('content_item', 'content_item__workspace').filter(
            status='published',
            content_item__workspace__slug=_workspace_slug(self.request),
        )


class AdminSourceConnectorViewSet(WorkspaceScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Admin-visible source connector config without secret values."""

    queryset = SourceConnector.objects.all()
    serializer_class = SourceConnectorSerializer
    search_fields = ['name', 'platform', 'account_or_site', 'owner']
    ordering_fields = ['platform', 'name', 'updated_at']


class AdminIngestionRunViewSet(WorkspaceScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Admin ingestion run audit log: cursors, counts, costs, retries, errors."""

    queryset = IngestionRun.objects.select_related('connector').all()
    serializer_class = IngestionRunSerializer
    ordering_fields = ['created_at', 'started_at', 'finished_at', 'new_count', 'failed_count']
    workspace_filter = 'connector__workspace__slug'


class AdminContentReviewViewSet(WorkspaceScopedQuerysetMixin, viewsets.ModelViewSet):
    """API-3: admin review/publish queue for Content Relay."""

    queryset = EditorialReview.objects.select_related('content_item').all()
    serializer_class = AdminContentReviewSerializer
    search_fields = ['suggested_title', 'suggested_text', 'content_item__raw_text', 'content_item__source_url']
    ordering_fields = ['updated_at', 'published_at', 'reviewed_at', 'content_item__published_at']
    ordering = ['-updated_at']
    workspace_filter = 'content_item__workspace__slug'

    def _transition(self, request, next_status, updates=None):
        review = self.get_object()
        audit_id = _audit_id(request, f'content-review-{review.id}-{next_status}')
        try:
            if next_status == 'published' and 'human_review_required' in (review.risk_labels or []):
                if request.data.get('high_risk_confirmed') is not True:
                    return _error(
                        'high_risk_confirmation_required',
                        'High-risk content requires explicit human confirmation before publication.',
                        audit_id=audit_id,
                    )
            review.transition_to(next_status)
            for field, value in (updates or {}).items():
                setattr(review, field, value)
            if next_status in ('approved', 'published'):
                review.reviewer = _operator(request)
                review.reviewed_at = timezone.now()
            if next_status == 'published':
                review.published_at = timezone.now()
            review.save()
        except ValidationError as error:
            return _error('illegal_transition', error.message_dict if hasattr(error, 'message_dict') else str(error), audit_id=audit_id)
        return Response({
            'status': review.status,
            'id': review.id,
            'audit_id': audit_id,
            'externalSideEffect': False,
            'review': AdminContentReviewSerializer(review).data,
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._transition(request, 'approved')

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        return self._transition(request, 'published')

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        reason = request.data.get('rejection_reason') or 'Rejected by human reviewer.'
        return self._transition(request, 'rejected', {'rejection_reason': reason})


def _match_data(match):
    return {
        'id': match.id,
        'workspace': match.workspace_id,
        'event': match.event_id,
        'campaign_key': match.campaign_key,
        'status': match.status,
        'overall_score': match.overall_score,
        'subscores': {
            'theme': match.theme_score,
            'audience': match.audience_score,
            'timing': match.timing_score,
            'city': match.city_score,
            'resources': match.resource_score,
            'information': match.information_score,
        },
        'fit_points': match.fit_points,
        'missing_information': match.missing_information,
        'conflicts': match.conflicts,
        'citations': match.citations,
        'score_citations': match.score_citations,
        'scoring_version': match.scoring_version,
        'model_version': match.model_version,
        'reviewed_by': match.reviewed_by,
        'reviewed_at': match.reviewed_at,
        'created_at': match.created_at,
        'updated_at': match.updated_at,
    }


def _proposal_data(proposal):
    return {
        'id': proposal.id,
        'match': proposal.match_id,
        'version': proposal.version,
        'previous_version': proposal.previous_version_id,
        'status': proposal.status,
        'packages': proposal.packages,
        'partner_value': proposal.partner_value,
        'workspace_value': proposal.workspace_value,
        'resources': proposal.resources,
        'pending_questions': proposal.pending_questions,
        'risks': proposal.risks,
        'source_refs': proposal.source_refs,
        'evidence': proposal.evidence,
        'guardrail_checks': proposal.guardrail_checks,
        'edit_summary': proposal.edit_summary,
        'edited_by': proposal.edited_by,
        'approved_by': proposal.approved_by,
        'approved_at': proposal.approved_at,
        'rejection_reason': proposal.rejection_reason,
        'created_at': proposal.created_at,
        'updated_at': proposal.updated_at,
    }


class AdminCollaborationMatchViewSet(viewsets.ViewSet):
    """Evidence-bound match API with no external side effects."""

    action_name = 'collaboration-match-generate'

    def _queryset(self, request):
        from .models import CollaborationMatch
        return CollaborationMatch.objects.select_related('workspace', 'event').filter(
            workspace__slug=_workspace_slug(request),
        )

    def list(self, request):
        return Response({
            'externalSideEffect': False,
            'results': [_match_data(item) for item in self._queryset(request).order_by('-updated_at')],
        })

    def retrieve(self, request, pk=None):
        item = get_object_or_404(self._queryset(request), pk=pk)
        return Response({'externalSideEffect': False, 'data': _match_data(item)})

    @action(detail=False, methods=['post'])
    def generate(self, request):
        contract_error = require_mutation_contract(request, self.action_name)
        if contract_error:
            return contract_error
        idempotency_error = claim_idempotency(request, self.action_name)
        if idempotency_error:
            return idempotency_error

        workspace = _active_workspace(request)
        event_id = request.data.get('event_id') or request.data.get('event')
        if not event_id:
            return error_response(request, self.action_name, 'event_required', 'event_id is required.')
        event = UniversityEvent.objects.filter(workspace=workspace, pk=event_id).first()
        if not event:
            return error_response(
                request, self.action_name, 'event_not_found',
                'The event does not exist in the active workspace.',
                http_status=status.HTTP_404_NOT_FOUND,
            )

        requested_ids = request.data.get('capability_ids')
        capability_query = Capability.objects.filter(workspace=workspace, approved=True)
        if requested_ids is not None and not isinstance(requested_ids, list):
            return error_response(
                request, self.action_name, 'invalid_capability_ids',
                'capability_ids must be an array.',
            )
        capabilities = list(
            capability_query.filter(id__in=requested_ids).order_by('code')
            if requested_ids is not None else capability_query.order_by('code')
        )
        if requested_ids is not None and len(capabilities) != len(set(requested_ids)):
            return error_response(
                request, self.action_name, 'capability_not_found',
                'Every capability must be approved and belong to the active workspace.',
                http_status=status.HTTP_404_NOT_FOUND,
            )

        event_ref = f'event:{event.id}'
        citations = [{
            'id': event_ref,
            'source_type': 'event',
            'source_id': str(event.id),
            'label': event.title,
            'url': event.source_url,
        }]
        citations.extend({
            'id': f'capability:{capability.id}',
            'source_type': 'capability',
            'source_id': str(capability.id),
            'label': capability.title,
            'source_ids': capability.source_ids,
        } for capability in capabilities)
        citation_ids = [item['id'] for item in citations]

        event_text = ' '.join(filter(None, [event.title, event.description, event.category, event.event_type])).lower()
        capability_text = ' '.join(
            ' '.join(filter(None, [item.title, item.title_en, item.boundary, item.boundary_en]))
            for item in capabilities
        ).lower()
        terms = ('ai', '人工智能', 'web3', '区块链', '机器人', '财经', 'hackathon', '黑客松')
        overlap = sum(term in event_text and term in capability_text for term in terms)
        scores = {
            'theme_score': min(100, 55 + overlap * 10) if capabilities else 25,
            'audience_score': 85 if event.university else 30,
            'timing_score': 85 if event.event_date else 35,
            'city_score': 80 if event.location else 40,
            'resource_score': min(100, 30 + len(capabilities) * 15) if capabilities else 15,
        }
        complete = [event.title, event.university, event.description, event.source_url, event.event_date, event.location]
        scores['information_score'] = round(100 * sum(bool(value) for value in complete) / len(complete))
        overall_score = round(sum(scores.values()) / len(scores))
        fit_points = [
            f'{event.university} 的活动主题可与已审核能力“{item.title}”进一步核验合作边界。'
            for item in capabilities[:3]
        ] or ['当前没有已审核能力可直接承诺，需由运营补充能力证据。']
        missing = []
        if not event.event_date:
            missing.append('活动日期待确认')
        if not event.location:
            missing.append('活动地点或线上形式待确认')
        if not event.registration_url:
            missing.append('报名或官方活动入口待确认')
        if not capabilities:
            missing.append('可投入资源与负责人待确认')
        score_citations = {
            'theme': citation_ids,
            'audience': [event_ref],
            'timing': [event_ref],
            'city': [event_ref],
            'resources': citation_ids,
            'information': [event_ref],
        }

        from .models import CollaborationMatch
        defaults = {
            **scores,
            'status': 'suggested',
            'overall_score': overall_score,
            'fit_points': fit_points,
            'missing_information': missing,
            'conflicts': [],
            'citations': citations,
            'score_citations': score_citations,
            'model_version': 'deterministic-match-v1',
        }
        try:
            with transaction.atomic():
                match, created = CollaborationMatch.objects.get_or_create(
                    workspace=workspace,
                    event=event,
                    campaign_key=str(request.data.get('campaign_key') or f'event-{event.id}')[:120],
                    scoring_version=str(input_version(request))[:80],
                    defaults=defaults,
                )
        except (IntegrityError, ValidationError) as error:
            return error_response(
                request, self.action_name, 'match_generation_failed', str(error),
                http_status=status.HTTP_409_CONFLICT,
            )
        return success_response(
            request,
            self.action_name,
            {'match': _match_data(match), 'created': created, 'idempotent_replay': not created},
            http_status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            external_side_effect=False,
        )

    def _review(self, request, pk, next_status):
        action_name = f'collaboration-match-{next_status}'
        contract_error = require_mutation_contract(request, action_name)
        if contract_error:
            return contract_error
        idempotency_error = claim_idempotency(request, action_name)
        if idempotency_error:
            return idempotency_error
        match = get_object_or_404(self._queryset(request), pk=pk)
        if match.status == next_status:
            return success_response(request, action_name, {'match': _match_data(match), 'idempotent_replay': True})
        try:
            if match.status != 'suggested':
                raise ValidationError({'status': f'Illegal match transition: {match.status} -> {next_status}'})
            match.status = next_status
            match.reviewed_by = request.headers.get('X-ClawTree-Operator') or _operator(request)
            match.reviewed_at = timezone.now()
            match.save()
        except ValidationError as error:
            return error_response(request, action_name, 'illegal_transition', str(error))
        return success_response(request, action_name, {'match': _match_data(match), 'idempotent_replay': False})

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        return self._review(request, pk, 'verified')

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._review(request, pk, 'rejected')


class AdminProposalViewSet(viewsets.ViewSet):
    """Versioned three-tier proposal drafts; never creates outreach."""

    action_name = 'proposal-generate'

    def _queryset(self, request):
        from .models import Proposal
        return Proposal.objects.select_related('match', 'match__workspace', 'match__event').filter(
            match__workspace__slug=_workspace_slug(request),
        )

    def list(self, request):
        return Response({
            'externalSideEffect': False,
            'results': [_proposal_data(item) for item in self._queryset(request).order_by('-updated_at')],
        })

    def retrieve(self, request, pk=None):
        item = get_object_or_404(self._queryset(request), pk=pk)
        return Response({'externalSideEffect': False, 'data': _proposal_data(item)})

    @action(detail=False, methods=['post'])
    def generate(self, request):
        contract_error = require_mutation_contract(request, self.action_name)
        if contract_error:
            return contract_error
        idempotency_error = claim_idempotency(request, self.action_name)
        if idempotency_error:
            return idempotency_error

        match_id = request.data.get('match_id') or request.data.get('match')
        if not match_id:
            return error_response(request, self.action_name, 'match_required', 'match_id is required.')
        match = get_object_or_404(AdminCollaborationMatchViewSet()._queryset(request), pk=match_id)
        if match.status != 'verified':
            return error_response(
                request, self.action_name, 'verified_match_required',
                'A proposal draft can only be generated from a human-verified match.',
                http_status=status.HTTP_409_CONFLICT,
            )

        from .models import Proposal
        try:
            # Defaulting to version 1 makes a retry deterministically address
            # the same row. Clients explicitly request version 2+ for edits.
            version = int(request.data.get('version', 1))
        except (TypeError, ValueError):
            return error_response(request, self.action_name, 'invalid_version', 'version must be an integer.')
        same_version = Proposal.objects.filter(match=match, version=version).first()
        if same_version:
            return success_response(
                request, self.action_name,
                {'proposal': _proposal_data(same_version), 'created': False, 'idempotent_replay': True},
            )
        previous = Proposal.objects.filter(match=match, version=version - 1).first() if version > 1 else None

        source_refs = [item['id'] if isinstance(item, dict) else item for item in (match.citations or [])]
        fit_summary = '；'.join(match.fit_points[:2]) if match.fit_points else '合作方向仍需人工补充'
        packages = [
            {
                'name': 'light',
                'value': '媒体支持与活动回顾建议稿',
                'resources': ['公开来源整理', '活动回顾内容框架'],
                'nextStep': '双方确认公开信息、内容授权与发布时间',
            },
            {
                'name': 'medium',
                'value': '主题分享或线上 Space 联动建议稿',
                'resources': ['议题共创', '候选嘉宾与传播清单（均待人工确认）'],
                'nextStep': '确认受众、议题、嘉宾、时间与各方责任',
            },
            {
                'name': 'deep',
                'value': '联合活动或黑客松建议稿',
                'resources': ['活动机制共创', '项目招募与赛后复盘框架'],
                'nextStep': '进入正式需求澄清、预算、法务与资源审批',
            },
        ]
        risks = [*(match.conflicts or []), '资源、嘉宾、费用、权益和主办身份均未获得最终批准']
        pending = [
            *(match.missing_information or []),
            '对方的合作目标、目标受众和成功指标是什么？',
            '各方可投入资源及决策人是谁？',
        ]
        defaults = {
            'previous_version': previous,
            'status': 'draft',
            'packages': packages,
            'partner_value': f'围绕“{match.event.title}”提供分层、可选择且可核验的合作路径。',
            'workspace_value': '沉淀高校合作案例、公开内容资产与长期生态关系。',
            'resources': [item.title for item in match.workspace.capabilities.filter(approved=True).order_by('code')],
            'pending_questions': pending,
            'risks': risks,
            'source_refs': source_refs,
            'evidence': [
                {'claimId': 'proposal_basis', 'claim': fit_summary, 'sourceIds': source_refs},
                {
                    'claimId': 'risks',
                    'claim': '所有未批准资源必须在对外使用前人工确认。',
                    'sourceIds': source_refs,
                },
            ],
            'guardrail_checks': {
                'noUnapprovedPrize': True,
                'noGuaranteedExposure': True,
                'humanApprovalRequired': True,
                'externalSideEffectsAllowed': False,
            },
            'edit_summary': 'Deterministic three-tier proposal draft generated from the verified match.',
            'edited_by': request.headers.get('X-ClawTree-Operator') or _operator(request),
        }
        try:
            with transaction.atomic():
                proposal = Proposal.objects.create(match=match, version=version, **defaults)
        except (IntegrityError, ValidationError) as error:
            return error_response(
                request, self.action_name, 'proposal_generation_failed', str(error),
                http_status=status.HTTP_409_CONFLICT,
            )
        return success_response(
            request,
            self.action_name,
            {'proposal': _proposal_data(proposal), 'created': True, 'idempotent_replay': False},
            http_status=status.HTTP_201_CREATED,
            external_side_effect=False,
        )


class UniversityEventViewSet(WorkspaceScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """高校 AI/Web3 活动 API（只读）"""
    queryset = UniversityEvent.objects.all()
    serializer_class = AdminUniversityEventSerializer
    filterset_class = UniversityEventFilter
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['title', 'university', 'description', 'source_name', 'location']
    ordering_fields = ['event_date', 'created_at', 'score']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """活动统计摘要"""
        qs = self.get_queryset()
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

    @action(detail=False, methods=['post'])
    def generate_email(self, request):
        """AI 生成合作邀请邮件"""
        event_ids = request.data.get('event_ids', [])
        if not event_ids:
            return Response(
                {'error': '请提供 event_ids'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        llm_client, llm_model = _init_llm()
        if not llm_client:
            return Response(
                {'error': 'LLM 未配置（请设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY）'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        events = self.get_queryset().filter(id__in=event_ids).select_related('workspace', 'workspace__brand_profile')
        if not events:
            return Response(
                {'error': '未找到匹配的活动'},
                status=status.HTTP_404_NOT_FOUND,
            )

        results = []
        for ev in events:
            profile = getattr(ev.workspace, 'brand_profile', None)
            capabilities = ev.workspace.capabilities.filter(approved=True).order_by('code')
            capability_text = '；'.join(item.title for item in capabilities) or '暂无已审核能力，必须转人工确认'
            prompt = EMAIL_PROMPT_TEMPLATE.format(
                brand_name=ev.workspace.name,
                mission=profile.mission if profile else '',
                capabilities=capability_text,
                signature=profile.outreach_signature if profile else ev.workspace.name,
                university=ev.university,
                title=ev.title,
                date=str(ev.event_date) if ev.event_date else '待定',
                event_type=ev.event_type,
                description=ev.description or '暂无简介',
            )

            try:
                msg = llm_client.chat.completions.create(
                    model=llm_model,
                    max_tokens=800,
                    temperature=0.7,
                    messages=[
                        {'role': 'system', 'content': EMAIL_SYSTEM_PROMPT},
                        {'role': 'user', 'content': prompt},
                    ],
                )
                body = msg.choices[0].message.content.strip()
            except Exception as e:
                body = f'[生成失败: {e}]'

            results.append({
                'event_id': ev.id,
                'title': ev.title,
                'university': ev.university,
                'email_body': body,
            })

            # 存入外联草稿表
            OutreachDraft.objects.create(
                workspace=ev.workspace,
                university_event=ev,
                email_body=body,
                recipient_email=ev.contact_email or '',
                status='draft',
            )

            time.sleep(0.3)

        return Response({'results': results})


class PublicUniversityEventViewSet(WorkspaceScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """API-2: public event list; no contact fields and no draft-generation action."""

    queryset = UniversityEvent.objects.all()
    serializer_class = UniversityEventSerializer
    filterset_class = UniversityEventFilter
    search_fields = ['title', 'university', 'description', 'source_name', 'location']
    ordering_fields = ['event_date', 'created_at']


class OutreachDraftViewSet(WorkspaceScopedQuerysetMixin, viewsets.ModelViewSet):
    """外联审批草稿 API"""
    queryset = OutreachDraft.objects.all()
    serializer_class = OutreachDraftSerializer

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        draft = self.get_object()
        if draft.status not in ('draft', 'awaiting_approval'):
            return Response({'error': '仅草稿和待审批状态可批准'}, status=400)

        draft.status = 'approved'
        draft.approved_by = request.data.get('approved_by', 'admin')
        draft.approved_at = timezone.now()

        # 保存编辑后的内容
        edited_body = request.data.get('email_body', '')
        if edited_body:
            draft.email_body = edited_body
        draft.save()

        # 发送邮件
        try:
            subject = draft.subject or f'合作邀请｜{draft.workspace.name} — {draft.university_event.title}'
            recipient = draft.recipient_email or draft.university_event.contact_email
            if recipient:
                send_mail(
                    subject=subject,
                    message=draft.email_body,
                    from_email=None,  # 使用 DEFAULT_FROM_EMAIL
                    recipient_list=[recipient],
                    fail_silently=False,
                )
                return Response({'status': 'approved', 'id': draft.id, 'sent': True})
            return Response({'status': 'approved', 'id': draft.id, 'sent': False, 'reason': '无收件人邮箱'})
        except Exception as e:
            return Response({'status': 'approved', 'id': draft.id, 'sent': False, 'reason': str(e)})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        draft = self.get_object()
        draft.status = 'rejected'
        draft.save()
        return Response({'status': 'rejected', 'id': draft.id})

    @action(detail=True, methods=['post'])
    def anchor_proof(self, request, pk=None):
        """保存链上存证信息"""
        draft = self.get_object()
        draft.proof_tx_hash = request.data.get('tx_hash', '')
        draft.proof_network = request.data.get('network', '')
        draft.proof_explorer_url = request.data.get('explorer_url', '')
        draft.proof_created_at = timezone.now()
        draft.save(update_fields=['proof_tx_hash', 'proof_network', 'proof_explorer_url', 'proof_created_at'])
        return Response({
            'status': 'anchored',
            'id': draft.id,
            'proof_tx_hash': draft.proof_tx_hash,
            'proof_network': draft.proof_network,
            'proof_explorer_url': draft.proof_explorer_url,
            'proof_created_at': draft.proof_created_at,
        })


class EventReviewViewSet(WorkspaceScopedQuerysetMixin, viewsets.ModelViewSet):
    """活动回顾 API — 支持 CRUD"""
    queryset = EventReview.objects.all()
    serializer_class = EventReviewSerializer
    filterset_class = EventReviewFilter


class TweetReviewViewSet(WorkspaceScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """推文回顾 API（只读）"""
    queryset = TweetReview.objects.filter(is_review_worthy=True)
    serializer_class = TweetReviewSerializer
    filterset_class = TweetReviewFilter

    @action(detail=True, methods=['post'])
    def generate_space_summary(self, request, pk=None):
        """抓取 X Space 页面信息并 AI 生成语音节目总结"""
        tweet_review = self.get_object()
        space_url = tweet_review.space_url

        if not space_url:
            return Response(
                {'error': '该推文没有关联的 Space 语音链接'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 如果已有总结，检查是否强制重新生成
        force = request.data.get('force', False)
        if tweet_review.space_summary and not force:
            return Response({
                'space_url': space_url,
                'space_summary': tweet_review.space_summary,
                'cached': True,
            })

        llm_client, llm_model = _init_llm()
        if not llm_client:
            return Response(
                {'error': 'LLM 未配置（请设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY）'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Step 1: 尝试从 twitterapi.io 获取 Space 数据
        space_data = self._fetch_space_info(space_url)

        # Step 2: 构建 AI 提示词
        tweet_text = tweet_review.text_processed or tweet_review.text
        ai_summary = tweet_review.summary or ''

        system_prompt = (
            '你是 ClawTree 的语音内容分析专家。请根据提供的 X Space 语音节目信息和关联推文，'
            '生成一份结构化的节目总结。用中文输出，风格专业清晰。'
        )

        space_info_text = ''
        if space_data:
            space_info_text = (
                f'节目标题: {space_data.get("title", "未知")}\n'
                f'主持人: {space_data.get("host", "未知")}\n'
                f'参与者数量: {space_data.get("participant_count", "未知")}\n'
                f'状态: {space_data.get("state", "未知")}\n'
                f'计划开始时间: {space_data.get("scheduled_start", "未知")}\n'
            )

        prompt = f"""请为以下 X Space 语音节目生成一份总结。

=== 关联推文内容 ===
{tweet_text[:1500]}

=== 推文 AI 摘要 ===
{ai_summary}

=== Space 节目信息 ===
{space_info_text or '未能获取到 Space 详细数据，请根据推文内容推断。'}

=== Space 链接 ===
{space_url}

请生成一份结构化的总结，包含：
1. 🎙️ **节目概述** — 一句话概括这场 Space 的主题和定位
2. 📋 **核心议题** — 根据推文和 Space 信息，列出 2-4 个可能的讨论要点
3. 👥 **参与方** — 提到的主办方、嘉宾或合作方
4. 📌 **关键看点** — 值得关注的内容亮点

使用 Markdown 格式，200-400 字。只返回总结内容，不要其他解释。"""

        try:
            msg = llm_client.chat.completions.create(
                model=llm_model,
                max_tokens=800,
                temperature=0.7,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': prompt},
                ],
            )
            summary = msg.choices[0].message.content.strip()
        except Exception as e:
            return Response(
                {'error': f'AI 生成失败: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 保存总结
        tweet_review.space_summary = summary
        tweet_review.save(update_fields=['space_summary'])

        return Response({
            'space_url': space_url,
            'space_summary': summary,
            'cached': False,
        })

    def _fetch_space_info(self, space_url):
        """尝试通过 twitterapi.io 获取 Space 信息"""
        import re
        twitter_key = os.environ.get('TWITTER_API_KEY', '')
        if not twitter_key:
            return None

        # 从 URL 中提取 space_id
        match = re.search(r'/i/spaces/([a-zA-Z0-9]+)', space_url)
        if not match:
            return None

        space_id = match.group(1)

        try:
            resp = requests.get(
                'https://api.twitterapi.io/twitter/spaces',
                params={'spaceIds': space_id},
                headers={'X-API-Key': twitter_key},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            spaces = data.get('data', {}).get('spaces', data.get('spaces', []))
            if spaces:
                return spaces[0] if isinstance(spaces, list) else spaces
        except Exception:
            pass

        return None


# =============================================================================
# 自动化流水线 API
# =============================================================================

from .serializers import PipelineRunSerializer, PipelineConfigSerializer


class PipelineViewSet(viewsets.ViewSet):
    """自动化流水线控制 API — 4 步骤：采集 → 推文 → 邮件 → 审批"""

    def list(self, request):
        """获取流水线状态和最新运行记录"""
        workspace = _active_workspace(request)
        configs = PipelineConfig.objects.filter(workspace=workspace)
        steps = []
        for c in configs:
            last_run = PipelineRun.objects.filter(workspace=workspace, step=c.step).first()
            steps.append({
                'step': c.step,
                'step_label': c.get_step_display(),
                'enabled': c.enabled,
                'schedule_time': c.schedule_time,
                'last_run': PipelineRunSerializer(last_run).data if last_run else None,
            })
        # 补上未配置的 step
        existing = set(c.step for c in configs)
        all_steps = [s[0] for s in PipelineRun.STEP_CHOICES]
        for step in all_steps:
            if step not in existing:
                last_run = PipelineRun.objects.filter(workspace=workspace, step=step).first()
                steps.append({
                    'step': step,
                    'step_label': dict(PipelineRun.STEP_CHOICES)[step],
                    'enabled': False,
                    'schedule_time': '08:00' if step == 'collect_events' else '10:00',
                    'max_count': 10,
                    'last_run': PipelineRunSerializer(last_run).data if last_run else None,
                })
        return Response(steps)

    @action(detail=False, methods=['post'])
    def configure(self, request):
        """保存某步的配置（enabled / schedule_time / max_count）"""
        step = request.data.get('step')
        if step not in dict(PipelineRun.STEP_CHOICES):
            return Response({'error': 'invalid step'}, status=400)
        workspace = _active_workspace(request)
        config, _ = PipelineConfig.objects.update_or_create(
            workspace=workspace,
            step=step,
            defaults={
                'enabled': request.data.get('enabled', False),
                'schedule_time': request.data.get('schedule_time', '08:00'),
                'max_count': int(request.data.get('max_count', 10)),
            },
        )
        return Response(PipelineConfigSerializer(config).data)

    @action(detail=False, methods=['post'])
    def stop(self, request):
        """请求停止某一步"""
        step = request.data.get('step')
        if step not in dict(PipelineRun.STEP_CHOICES):
            return Response({'error': 'invalid step'}, status=400)
        workspace = _active_workspace(request)
        PipelineRun.objects.filter(workspace=workspace, step=step, status='running').update(stop_requested=True)
        return Response({'status': 'stop_requested'})

    @action(detail=False, methods=['post'])
    def trigger(self, request):
        """启动/触发某一步"""
        step = request.data.get('step')
        if step not in dict(PipelineRun.STEP_CHOICES):
            return Response({'error': 'invalid step'}, status=400)
        workspace = _active_workspace(request)

        # 如果已有运行中的任务，先停止
        PipelineRun.objects.filter(workspace=workspace, step=step, status='running').update(
            stop_requested=True, status='stopped', finished_at=datetime.now(),
        )

        # 获取配置的上限
        config = PipelineConfig.objects.filter(workspace=workspace, step=step).first()
        max_count = config.max_count if config else 10

        run = PipelineRun.objects.create(workspace=workspace, step=step, status='running', started_at=datetime.now(),
                                          collected=max_count)  # 目标数
        try:
            if step == 'collect_events':
                self._run_collect_events(run, max_count)
            elif step == 'fetch_tweets':
                self._run_fetch_tweets(run, max_count)
            elif step == 'generate_emails':
                self._run_generate_emails(run, max_count)
            elif step == 'auto_approve':
                self._run_auto_approve(run, max_count)
        except Exception as e:
            run.status = 'failed'
            run.error_message = str(e)[:500]
            run.finished_at = datetime.now()
            run.save()
            return Response(PipelineRunSerializer(run).data, status=500)

        return Response(PipelineRunSerializer(run).data)

    def _should_stop(self, run):
        """检查是否需要停止（用户请求 + 达到上限）"""
        run.refresh_from_db(fields=['stop_requested'])
        return run.stop_requested

    def _run_collect_events(self, run, max_count):
        """Step 1: 自动发现 OpenClaw 输出的 JSON 文件并导入，达到上限停止"""
        import glob
        import os as _os
        t0 = time.time()
        try:
            data_dir = _os.path.join(_os.path.dirname(__file__), '..', 'data', 'highSchool')
            data_dir = _os.path.abspath(data_dir)
            json_files = sorted(glob.glob(_os.path.join(data_dir, 'events_*.json')) + glob.glob(_os.path.join(data_dir, 'events-*.json')))

            if not json_files:
                run.status = 'succeeded'
                run.error_message = '暂无新的采集文件'
            else:
                total_saved = 0
                total_skipped = 0
                total_collected = 0
                for f in json_files:
                    if self._should_stop(run):
                        run.status = 'stopped'
                        break
                    with open(f, 'r', encoding='utf-8') as fh:
                        data = json.load(fh)
                    events = data.get('events', [])
                    total_collected += len(events)

                    from .management.commands.save_events import _parse_date, _infer_category
                    VALID_TYPES = ['黑客松', '分享会', '讲座', '竞赛', '研讨会', '论坛', '工作坊', '夏令营', '其他']

                    for ev in events:
                        if total_saved >= max_count:
                            run.status = 'succeeded'
                            break
                        if self._should_stop(run):
                            run.status = 'stopped'
                            break
                        contact = ev.get('contact', {})
                        title = (ev.get('title') or ev.get('activity_name') or '')[:500]
                        university = (ev.get('university') or ev.get('school') or '')[:200]
                        desc = (ev.get('description') or '')[:1000]
                        source_url = ev.get('source_url', '')
                        ev_type = ev.get('event_type') or ev.get('type') or '其他'
                        if ev_type not in VALID_TYPES:
                            ev_type = '其他'
                        raw_score = ev.get('score') or ev.get('confidence')
                        if raw_score is not None:
                            score = int(raw_score * 100) if isinstance(raw_score, (int, float)) and raw_score <= 1 else int(min(raw_score, 100))
                        else:
                            score = 0
                        if not source_url:
                            total_skipped += 1
                            continue

                        _, created = UniversityEvent.objects.update_or_create(
                            workspace=run.workspace,
                            source_url=source_url,
                            defaults={
                                'title': title, 'university': university,
                                'event_date': _parse_date(ev.get('event_date') or ev.get('date') or None),
                                'description': desc, 'location': (ev.get('location') or '')[:300],
                                'source_name': 'openclaw',
                                'contact_email': (ev.get('contact_email') or contact.get('official_email') or '')[:200],
                                'contact_ai_email': (ev.get('contact_ai_email') or contact.get('ai_dept_email') or '')[:200],
                                'contact_phone': (ev.get('contact_phone') or contact.get('phone') or '')[:50],
                                'contact_wechat': (ev.get('contact_wechat') or contact.get('wechat') or '')[:100],
                                'contact_qq': (ev.get('contact_qq') or contact.get('qq') or '')[:50],
                                'category': _infer_category(title, desc), 'event_type': ev_type,
                                'score': score, 'raw_data': json.dumps(ev, ensure_ascii=False),
                            },
                        )
                        if created:
                            total_saved += 1
                        else:
                            total_skipped += 1
                    if run.status in ('stopped', 'succeeded'):
                        break

                if run.status == 'running':
                    run.status = 'succeeded'
                run.collected = total_collected
                run.added = total_saved
                run.skipped = total_skipped
        except Exception as e:
            run.status = 'failed'
            run.error_message = str(e)[:500]
        run.duration_ms = int((time.time() - t0) * 1000)
        run.finished_at = datetime.now()
        run.save()

    def _run_fetch_tweets(self, run, max_count):
        """Step 2: 直接调 twitterapi.io 采集推文 + AI 筛选过滤 + 入库"""
        from datetime import datetime as dt
        from home.management.commands.fetch_tweets_v2 import (
            _parse_twitter_date, _extract_media_urls, _get_tweet_text, _extract_space_url,
        )

        t0 = time.time()
        try:
            twitter_key = os.environ.get('TWITTER_API_KEY', 'new1_b31c74fb9e154691aedfe9c2a8b5e5c0')
            llm_client, llm_model = self._init_llm()
            if not llm_client:
                raise Exception('未配置 LLM API Key')

            # 调用 twitterapi.io 获取推文
            resp = requests.get(
                'https://api.twitterapi.io/twitter/user/tweet_timeline',
                params={'userId': '3476819954'},
                headers={'X-API-Key': twitter_key},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get('status') != 'success':
                raise Exception(data.get('msg', 'API error'))

            tweets = data.get('data', {}).get('tweets', [])
            run.collected = len(tweets)

            saved = skipped = polished = 0
            FILTER_SYSTEM = (
                '你是一个活动内容审核专家。请分析推文内容，判断是否属于大树财经相关的'
                '"高校行/AI活动/Web3活动"内容。你只返回 JSON，不返回其他内容。'
            )
            FILTER_PROMPT = """请分析以下推文，判断它是否属于大树财经活动回顾相关的内容。

推文内容: {text}

属于活动回顾的内容包括（满足任一即可）：
- 高校/大学/学院 线下活动、讲座、论坛、黑客松、工作坊
- 校园行、高校巡回、进校园相关活动
- AI / Web3 高校生态活动
- AI 相关的比赛/大赛/争霸赛
- 区块链/Web3 相关的行业峰会
- 黑客松/Hackathon 活动
- 世界杯相关的体育/活动内容

不属于：纯币圈行情、交易所促销、节日祝福、个人生活分享

请判断后只返回 JSON：{{"is_review_worthy": true/false, "summary": "...", "is_sensitive": true/false, "sensitive_reason": "..."}}"""

            for i, tweet in enumerate(tweets):
                if saved >= max_count:
                    break
                if self._should_stop(run):
                    run.status = 'stopped'
                    break

                tweet_id = tweet.get('id', '')
                text = _get_tweet_text(tweet)
                twitter_url = tweet.get('twitterUrl', tweet.get('url', ''))
                media_urls = _extract_media_urls(tweet)
                space_url = _extract_space_url(tweet)
                published_at = _parse_twitter_date(tweet.get('createdAt'))

                # 已存在则跳过
                if TweetReview.objects.filter(workspace=run.workspace, tweet_id=tweet_id).exists():
                    skipped += 1
                    continue

                # AI 分析
                try:
                    analysis = json.loads(
                        llm_client.chat.completions.create(
                            model=llm_model,
                            messages=[
                                {'role': 'system', 'content': FILTER_SYSTEM},
                                {'role': 'user', 'content': FILTER_PROMPT.format(text=text[:2000])},
                            ],
                            temperature=0.3, max_tokens=300,
                        ).choices[0].message.content or '{}'
                    )
                except json.JSONDecodeError:
                    skipped += 1
                    continue

                if not analysis.get('is_review_worthy'):
                    skipped += 1
                    continue

                # 敏感文案润色
                text_processed = ''
                if analysis.get('is_sensitive'):
                    try:
                        polish_resp = llm_client.chat.completions.create(
                            model=llm_model,
                            messages=[
                                {'role': 'system', 'content': '你是专业财经编辑。请对推文润色，移除敏感表达，保持核心信息不变。只返回润色后文本。'},
                                {'role': 'user', 'content': f'请润色以下推文（原因：{analysis.get("sensitive_reason")}）：\n\n{text}'},
                            ],
                            temperature=0.5, max_tokens=500,
                        )
                        text_processed = polish_resp.choices[0].message.content or ''
                        if text_processed:
                            polished += 1
                    except Exception:
                        pass

                TweetReview.objects.update_or_create(
                    workspace=run.workspace,
                    tweet_id=tweet_id,
                    defaults={
                        'text': text,
                        'text_processed': text_processed or '',
                        'media_urls': json.dumps(media_urls, ensure_ascii=False),
                        'twitter_url': twitter_url,
                        'space_url': space_url,
                        'summary': analysis.get('summary', '')[:200],
                        'is_review_worthy': True,
                        'is_sensitive': analysis.get('is_sensitive', False),
                        'published_at': published_at,
                        'raw_data': json.dumps(tweet, ensure_ascii=False),
                    },
                )
                saved += 1
                time.sleep(0.3)

            run.added = saved
            run.skipped = skipped
            run.failed = polished  # reuse as "润色数"
            if run.status == 'running':
                run.status = 'succeeded'

        except Exception as e:
            run.status = 'failed'
            run.error_message = str(e)[:500]
        run.duration_ms = int((time.time() - t0) * 1000)
        run.finished_at = datetime.now()
        run.save()

    def _run_generate_emails(self, run, max_count):
        """Step 3: 对未外联活动 AI 生成邮件，达到上限停止"""
        t0 = time.time()
        try:
            events = UniversityEvent.objects.filter(workspace=run.workspace, is_contacted=False)[:max_count * 2]
            if not events.exists():
                run.status = 'succeeded'
                run.error_message = 'no events to outreach'
            else:
                llm_client, llm_model = self._init_llm()
                if not llm_client:
                    raise Exception('no LLM API Key')
                generated = 0
                for ev in events:
                    if generated >= max_count:
                        break
                    if self._should_stop(run):
                        run.status = 'stopped'
                        break
                    if OutreachDraft.objects.filter(workspace=run.workspace, university_event=ev).exists():
                        run.skipped += 1
                        continue
                    try:
                        email_body = self._generate_single_email(llm_client, llm_model, ev)
                        OutreachDraft.objects.create(
                            workspace=run.workspace,
                            university_event=ev,
                            subject='collab: ' + ev.title[:80],
                            email_body=email_body,
                            recipient_email=ev.contact_email or ev.contact_ai_email or '',
                            status='draft',
                        )
                        generated += 1
                        run.added += 1
                    except Exception:
                        run.failed += 1
                run.collected = events.count()
                if run.status == 'running':
                    run.status = 'succeeded'
        except Exception as e:
            run.status = 'failed'
            run.error_message = str(e)[:500]
        run.duration_ms = int((time.time() - t0) * 1000)
        run.finished_at = datetime.now()
        run.save()

    def _run_auto_approve(self, run, max_count):
        """Step 4: 自动审批并发送，达到上限停止"""
        t0 = time.time()
        try:
            drafts = OutreachDraft.objects.filter(workspace=run.workspace, status__in=['draft', 'awaiting_approval'])[:max_count * 2]
            run.collected = drafts.count()
            for draft in drafts:
                if run.added >= max_count:
                    break
                if self._should_stop(run):
                    run.status = 'stopped'
                    break
                try:
                    draft.status = 'approved'
                    draft.approved_by = 'auto-pipeline'
                    draft.approved_at = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
                    draft.save()
                    recipient = draft.recipient_email or draft.university_event.contact_email
                    if recipient:
                        send_mail(
                            subject=draft.subject or 'TreeFinance',
                            message=draft.email_body, from_email=None,
                            recipient_list=[recipient], fail_silently=True,
                        )
                    run.added += 1
                except Exception:
                    run.failed += 1
            if run.status == 'running':
                run.status = 'succeeded'
        except Exception as e:
            run.status = 'failed'
            run.error_message = str(e)[:500]
        run.duration_ms = int((time.time() - t0) * 1000)
        run.finished_at = datetime.now()
        run.save()

        run.finished_at = datetime.now()
        run.save()

    def _init_llm(self):
        deepseek_key = os.environ.get('DEEPSEEK_API_KEY', '')
        if deepseek_key:
            return (OpenAI(api_key=deepseek_key, base_url='https://api.deepseek.com'), 'deepseek-chat')
        openai_key = os.environ.get('OPENAI_API_KEY')
        if openai_key:
            return (OpenAI(api_key=openai_key, base_url=os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1')), os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'))
        return (None, None)

    def _generate_single_email(self, client, model, event):
        prompt = f"""你是一个高校合作外联助手。请根据以下活动信息，撰写一封得体、专业的合作邀请邮件。

高校：{event.university}
活动：{event.title}
日期：{event.event_date or '待定'}
地点：{event.location or '待定'}
描述：{event.description or ''}

邮件要点：
1. 简介大树财经（Web3+AI 媒体活动品牌，推动全球高校行计划）
2. 表达对该活动的认可和合作意向
3. 提出2-3个具体合作方向（媒体支持、公开课联动、嘉宾推荐等）
4. 语气专业、简洁、真诚
5. 结尾署名：大树财经高校行团队

只输出邮件正文，不包含主题行。"""
        resp = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.7,
            max_tokens=2048,
        )
        return resp.choices[0].message.content or ''
