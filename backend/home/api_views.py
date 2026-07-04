import os
import json
import time

from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from openai import OpenAI

from .models import (
    UniversityEvent,
    EventReview,
    TweetReview,
    OutreachDraft,
    SourceConnector,
    IngestionRun,
    EditorialReview,
)
from .serializers import (
    UniversityEventSerializer,
    EventReviewSerializer,
    TweetReviewSerializer,
    OutreachDraftSerializer,
    SourceConnectorSerializer,
    IngestionRunSerializer,
    PublicContentRecapSerializer,
    AdminContentReviewSerializer,
)
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


EMAIL_SYSTEM_PROMPT = (
    '你是一个专业的媒体商务邮件撰写人。请根据活动信息和大树财经的高校行合作模式，'
    '撰写一封个性化合作邀请邮件。风格专业、真诚、简洁。'
)

EMAIL_PROMPT_TEMPLATE = """请为以下高校活动撰写一封大树财经的合作邀请邮件。

大树财经背景：
- Web3+AI 领域的媒体与活动品牌，正推动"全球高校行"计划
- 已成功与清华、浙大、复旦、上海交大等 30+ 高校链协合作
- 提供：媒体支持、活动复盘报道、AI/Web3 主题公开课、圆桌联动、嘉宾资源

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
4. 署名"大树财经高校行团队"
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


class PublicFeedView(APIView):
    """API-2: compact public feed envelope for /user.

    It intentionally contains no internal scores, raw source text, contacts, or
    model prompts. The response is safe to proxy from the frontend.
    """

    def get(self, request):
        recaps = EditorialReview.objects.select_related('content_item').filter(
            status='published',
        ).order_by('-published_at', '-updated_at')[:6]
        return Response({
            'externalSideEffect': False,
            'recaps': PublicContentRecapSerializer(recaps, many=True).data,
        })


class PublicContentRecapViewSet(viewsets.ReadOnlyModelViewSet):
    """Published Content Relay recaps for teachers and students."""

    serializer_class = PublicContentRecapSerializer
    search_fields = ['suggested_title', 'suggested_text', 'content_item__publisher']
    ordering_fields = ['published_at', 'updated_at', 'content_item__published_at']
    ordering = ['-published_at', '-updated_at']

    def get_queryset(self):
        return EditorialReview.objects.select_related('content_item').filter(status='published')


class AdminSourceConnectorViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-visible source connector config without secret values."""

    queryset = SourceConnector.objects.all()
    serializer_class = SourceConnectorSerializer
    search_fields = ['name', 'platform', 'account_or_site', 'owner']
    ordering_fields = ['platform', 'name', 'updated_at']


class AdminIngestionRunViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin ingestion run audit log: cursors, counts, costs, retries, errors."""

    queryset = IngestionRun.objects.select_related('connector').all()
    serializer_class = IngestionRunSerializer
    ordering_fields = ['created_at', 'started_at', 'finished_at', 'new_count', 'failed_count']


class AdminContentReviewViewSet(viewsets.ModelViewSet):
    """API-3: admin review/publish queue for Content Relay."""

    queryset = EditorialReview.objects.select_related('content_item').all()
    serializer_class = AdminContentReviewSerializer
    search_fields = ['suggested_title', 'suggested_text', 'content_item__raw_text', 'content_item__source_url']
    ordering_fields = ['updated_at', 'published_at', 'reviewed_at', 'content_item__published_at']
    ordering = ['-updated_at']

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


class UniversityEventViewSet(viewsets.ReadOnlyModelViewSet):
    """高校 AI/Web3 活动 API（只读）"""
    queryset = UniversityEvent.objects.all()
    serializer_class = UniversityEventSerializer
    filterset_class = UniversityEventFilter

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """活动统计摘要"""
        qs = UniversityEvent.objects
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

        events = UniversityEvent.objects.filter(id__in=event_ids)
        if not events:
            return Response(
                {'error': '未找到匹配的活动'},
                status=status.HTTP_404_NOT_FOUND,
            )

        results = []
        for ev in events:
            prompt = EMAIL_PROMPT_TEMPLATE.format(
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
                university_event=ev,
                email_body=body,
                recipient_email=ev.contact_email or '',
                status='draft',
            )

            time.sleep(0.3)

        return Response({'results': results})


class PublicUniversityEventViewSet(viewsets.ReadOnlyModelViewSet):
    """API-2: public event list; no contact fields and no draft-generation action."""

    queryset = UniversityEvent.objects.all()
    serializer_class = UniversityEventSerializer
    filterset_class = UniversityEventFilter
    search_fields = ['title', 'university', 'description', 'source_name']
    ordering_fields = ['event_date', 'created_at']


class OutreachDraftViewSet(viewsets.ModelViewSet):
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
            subject = draft.subject or f'合作邀请｜大树财经高校行 — {draft.university_event.title}'
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


class EventReviewViewSet(viewsets.ModelViewSet):
    """活动回顾 API — 支持 CRUD"""
    queryset = EventReview.objects.all()
    serializer_class = EventReviewSerializer
    filterset_class = EventReviewFilter


class TweetReviewViewSet(viewsets.ReadOnlyModelViewSet):
    """推文回顾 API（只读）"""
    queryset = TweetReview.objects.filter(is_review_worthy=True)
    serializer_class = TweetReviewSerializer
    filterset_class = TweetReviewFilter
