import os
import json
import time
import subprocess
import sys
import requests
from datetime import datetime

from django.core.exceptions import ValidationError
from django.core.mail import send_mail
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
