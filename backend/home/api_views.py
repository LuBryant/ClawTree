import os
import json
import time

from django.core.mail import send_mail
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from openai import OpenAI

from .models import UniversityEvent, EventReview, TweetReview, OutreachDraft
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
        draft.approved_at = time.strftime('%Y-%m-%dT%H:%M:%S+08:00')

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
        draft.proof_created_at = time.strftime('%Y-%m-%dT%H:%M:%S+08:00')
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
