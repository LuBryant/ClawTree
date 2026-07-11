import re
import uuid
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


SCORE_VALIDATORS = [MinValueValidator(0), MaxValueValidator(100)]


def _validate_string_list(value, field_name, *, allow_empty=True):
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise ValidationError({field_name: 'Must be a list of non-empty strings.'})
    if not allow_empty and not value:
        raise ValidationError({field_name: 'Must contain at least one item.'})


def _trace_contains_private_data(value, _path=''):
    """Fail closed when observability snapshots contain likely raw PII.

    Returns the path string of the first violation, or None if clean.
    """
    sensitive_keys = {
        'email', 'contact_email', 'recipient_email', 'phone', 'contact_phone',
        'wechat', 'qq', 'raw_prompt', 'prompt', 'raw_text', 'input_text',
        'email_body', 'message_body',
    }
    if isinstance(value, dict):
        for key, nested in value.items():
            current_path = f'{_path}.{key}' if _path else key
            if str(key).lower() in sensitive_keys:
                import logging
                logging.getLogger('clawtree').warning(
                    'AgentRun PII blocked: sensitive key=%r at path=%s', key, current_path,
                )
                return current_path
            found = _trace_contains_private_data(nested, current_path)
            if found:
                return found
        return None
    if isinstance(value, (list, tuple)):
        for i, item in enumerate(value):
            found = _trace_contains_private_data(item, f'{_path}[{i}]')
            if found:
                return found
        return None
    if isinstance(value, str):
        if value in {'[REDACTED]', '<redacted>'}:
            return None
        # Skip regex scanning on hash values — a SHA-256 hex string can
        # coincidentally match phone patterns but never contains real PII.
        if _path and 'hash' in _path.lower():
            return None
        email_match = re.search(r'(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w.-])', value)
        if email_match:
            import logging
            logging.getLogger('clawtree').warning(
                'AgentRun PII blocked: email=%r at path=%s', email_match.group(), _path,
            )
            return _path
        phone_match = re.search(r'(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)', value)
        if phone_match:
            import logging
            logging.getLogger('clawtree').warning(
                'AgentRun PII blocked: phone=%r at path=%s', phone_match.group(), _path,
            )
            return _path
    return None


class Workspace(models.Model):
    """Organization boundary for sources, capabilities, campaigns, and outreach."""

    slug = models.SlugField(max_length=80, unique=True, verbose_name='工作区标识')
    name = models.CharField(max_length=160, verbose_name='工作区名称')
    name_en = models.CharField(max_length=160, blank=True, default='', verbose_name='英文名称')
    industries = models.JSONField(default=list, blank=True, verbose_name='行业标签')
    is_reference_case = models.BooleanField(default=False, verbose_name='是否参考演示案例')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['name']
        verbose_name = '工作区'
        verbose_name_plural = '工作区'

    def __str__(self):
        return self.name


class BrandProfile(models.Model):
    """Reviewed public identity injected into agents instead of hard-coded brands."""

    workspace = models.OneToOneField(
        Workspace, on_delete=models.CASCADE, related_name='brand_profile', verbose_name='工作区',
    )
    mission = models.TextField(blank=True, default='', verbose_name='使命')
    mission_en = models.TextField(blank=True, default='', verbose_name='英文使命')
    outreach_signature = models.CharField(max_length=200, verbose_name='外联署名')
    outreach_signature_en = models.CharField(max_length=200, blank=True, default='', verbose_name='英文外联署名')
    guardrails = models.JSONField(default=list, blank=True, verbose_name='品牌与合规边界')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '品牌档案'
        verbose_name_plural = '品牌档案'

    def __str__(self):
        return f'{self.workspace.name} Brand Profile'


class Capability(models.Model):
    """Time-bounded, reviewed capability evidence owned by one workspace."""

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='capabilities', verbose_name='工作区',
    )
    code = models.SlugField(max_length=80, verbose_name='能力代码')
    title = models.CharField(max_length=200, verbose_name='能力名称')
    title_en = models.CharField(max_length=200, blank=True, default='', verbose_name='英文能力名称')
    source_ids = models.JSONField(default=list, blank=True, verbose_name='来源引用')
    owner = models.CharField(max_length=120, verbose_name='负责人')
    valid_until = models.DateField(verbose_name='有效期至')
    approved = models.BooleanField(default=False, verbose_name='已审核')
    boundary = models.TextField(blank=True, default='', verbose_name='能力边界')
    boundary_en = models.TextField(blank=True, default='', verbose_name='英文能力边界')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['workspace', 'code']
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'code'], name='unique_workspace_capability'),
        ]
        verbose_name = '工作区能力'
        verbose_name_plural = '工作区能力'

    def __str__(self):
        return f'{self.workspace.slug}:{self.title}'


class UniversityEvent(models.Model):
    """
    高校 AI/Web3 活动

    通过 OpenClaw University-Event-Collector 自动采集，source_url 作为去重键。
    数据格式对齐 openclaw skills 输出的 JSON 结构。
    """
    workspace = models.ForeignKey(
        Workspace, on_delete=models.PROTECT, related_name='university_events', default=1, verbose_name='工作区',
    )
    title = models.CharField(max_length=500, verbose_name='活动标题')
    university = models.CharField(max_length=200, verbose_name='高校名称')
    event_date = models.DateField(null=True, blank=True, verbose_name='活动日期')
    event_end_date = models.DateField(null=True, blank=True, verbose_name='结束日期')
    location = models.CharField(max_length=300, blank=True, default='', verbose_name='活动地点')
    description = models.TextField(blank=True, default='', verbose_name='活动描述')
    source_url = models.URLField(max_length=500, verbose_name='来源链接')
    source_name = models.CharField(max_length=100, blank=True, default='', verbose_name='来源平台')

    # 联系方式（对齐 OpenClaw contact 结构）
    contact_email = models.CharField(max_length=200, blank=True, default='', verbose_name='官方邮箱')
    contact_ai_email = models.CharField(max_length=200, blank=True, default='', verbose_name='AI部门邮箱')
    contact_phone = models.CharField(max_length=50, blank=True, default='', verbose_name='联系电话')
    contact_wechat = models.CharField(max_length=100, blank=True, default='', verbose_name='微信')
    contact_qq = models.CharField(max_length=50, blank=True, default='', verbose_name='QQ')

    CATEGORY_CHOICES = [
        ('AI', 'AI'),
        ('Web3', 'Web3'),
        ('AI+Web3', 'AI+Web3'),
    ]
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='AI',
        verbose_name='活动分类'
    )

    EVENT_TYPE_CHOICES = [
        ('黑客松', '黑客松'),
        ('分享会', '分享会'),
        ('讲座', '讲座'),
        ('竞赛', '竞赛'),
        ('研讨会', '研讨会'),
        ('论坛', '论坛'),
        ('工作坊', '工作坊'),
        ('夏令营', '夏令营'),
        ('其他', '其他'),
    ]
    event_type = models.CharField(
        max_length=20, choices=EVENT_TYPE_CHOICES, default='其他',
        verbose_name='活动类型'
    )

    registration_url = models.URLField(max_length=500, blank=True, default='', verbose_name='报名链接')
    timezone_name = models.CharField(max_length=64, default='Asia/Shanghai', verbose_name='活动时区')

    REGISTRATION_STATUS_CHOICES = [
        ('unknown', 'Unknown'),
        ('open', 'Open'),
        ('waitlist', 'Waitlist'),
        ('closed', 'Closed'),
        ('not_required', 'Not required'),
    ]
    registration_status = models.CharField(
        max_length=20, choices=REGISTRATION_STATUS_CHOICES, default='unknown', verbose_name='报名状态',
    )

    EVENT_STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('postponed', 'Postponed'),
        ('cancelled', 'Cancelled'),
    ]
    event_status = models.CharField(
        max_length=20, choices=EVENT_STATUS_CHOICES, default='scheduled', verbose_name='活动状态',
    )
    postponement_note = models.TextField(blank=True, default='', verbose_name='延期/取消说明')
    page_published_at = models.DateTimeField(null=True, blank=True, verbose_name='来源页发布时间')
    page_last_checked_at = models.DateTimeField(null=True, blank=True, verbose_name='来源页最近核验时间')
    freshness_status = models.CharField(
        max_length=20,
        choices=[('unknown', 'Unknown'), ('fresh', 'Fresh'), ('aging', 'Aging'), ('stale', 'Stale')],
        default='unknown',
        verbose_name='页面新鲜度',
    )
    date_conflict = models.BooleanField(default=False, verbose_name='日期是否冲突')
    date_conflict_note = models.TextField(blank=True, default='', verbose_name='日期冲突证据')

    SOURCE_TIER_CHOICES = [
        ('official_university', 'University official site'),
        ('official_department', 'Faculty / innovation center'),
        ('public_organization', 'Public student organization / society'),
        ('event_platform', 'Public event platform'),
        ('unknown', 'Unknown source'),
    ]
    source_tier = models.CharField(
        max_length=30, choices=SOURCE_TIER_CHOICES, default='unknown', verbose_name='来源等级',
    )
    officiality_score = models.PositiveSmallIntegerField(default=0, validators=SCORE_VALIDATORS)
    completeness_score = models.PositiveSmallIntegerField(default=0, validators=SCORE_VALIDATORS)
    freshness_score = models.PositiveSmallIntegerField(default=0, validators=SCORE_VALIDATORS)
    date_consistency_score = models.PositiveSmallIntegerField(default=0, validators=SCORE_VALIDATORS)
    confidence_explanation = models.JSONField(default=dict, blank=True, verbose_name='可信度解释')

    VERIFICATION_STATUS_CHOICES = [
        ('pending', 'Pending human verification'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]
    verification_status = models.CharField(
        max_length=20, choices=VERIFICATION_STATUS_CHOICES, default='pending', db_index=True,
        verbose_name='活动核验状态',
    )
    verification_queue_reasons = models.JSONField(default=list, blank=True, verbose_name='人工核验原因')
    verification_requested_at = models.DateTimeField(null=True, blank=True, verbose_name='进入核验队列时间')
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name='核验时间')
    verified_by = models.CharField(max_length=120, blank=True, default='', verbose_name='核验人')
    verification_note = models.TextField(blank=True, default='', verbose_name='核验备注')
    is_contacted = models.BooleanField(default=False, verbose_name='是否已联系')
    score = models.PositiveSmallIntegerField(default=0, verbose_name='置信度 (0-100)')
    raw_data = models.TextField(blank=True, default='', verbose_name='原始数据 JSON')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='收录时间')

    @property
    def has_public_contact(self):
        return bool(
            self.contact_email
            or self.contact_ai_email
            or self.contact_phone
            or self.contact_wechat
            or self.contact_qq
        )

    @property
    def is_expired(self):
        end_date = self.event_end_date or self.event_date
        return bool(end_date and end_date < timezone.localdate())

    @property
    def needs_human_verification(self):
        return self.verification_status == 'pending' or bool(self.verification_queue_reasons)

    def clean(self):
        super().clean()
        try:
            ZoneInfo(self.timezone_name)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValidationError({'timezone_name': 'Use a valid IANA timezone, for example Asia/Shanghai.'})
        if self.event_date and self.event_end_date and self.event_end_date < self.event_date:
            self.date_conflict = True
            if not self.date_conflict_note:
                self.date_conflict_note = 'event_end_date precedes event_date'
        if self.event_status in {'postponed', 'cancelled'} and not self.postponement_note:
            raise ValidationError({'postponement_note': 'Postponed or cancelled events require evidence notes.'})
        if self.verification_status == 'verified' and (not self.verified_by or not self.verified_at):
            raise ValidationError({'verification_status': 'Verified events require a human reviewer and timestamp.'})

    def refresh_radar_assessment(self, *, reference_time=None):
        """OR-3/6/7 deterministic, explainable scoring and fail-closed queueing."""
        now = reference_time or timezone.now()
        officiality = {
            'official_university': 100,
            'official_department': 90,
            'public_organization': 75,
            'event_platform': 55,
            'unknown': 20,
        }[self.source_tier]
        completeness_fields = (
            self.title, self.university, self.event_date, self.location,
            self.description, self.source_url, self.registration_url,
        )
        completeness = round(100 * sum(bool(value) for value in completeness_fields) / len(completeness_fields))
        if not self.page_last_checked_at:
            freshness, freshness_status = 0, 'unknown'
        else:
            age_days = max(0, (now - self.page_last_checked_at).days)
            if age_days <= 7:
                freshness, freshness_status = 100, 'fresh'
            elif age_days <= 14:
                freshness, freshness_status = 75, 'aging'
            elif age_days <= 30:
                freshness, freshness_status = 40, 'aging'
            else:
                freshness, freshness_status = 0, 'stale'
        if self.date_conflict or (self.event_date and self.event_end_date and self.event_end_date < self.event_date):
            date_consistency = 0
        elif self.event_date:
            date_consistency = 100
        else:
            date_consistency = 25
        overall = round(
            officiality * .35 + completeness * .25 + freshness * .20 + date_consistency * .20
        )
        reasons = []
        end_date = self.event_end_date or self.event_date
        if overall < 70:
            reasons.append('low_confidence')
        if self.date_conflict or date_consistency == 0:
            reasons.append('date_conflict')
        if end_date and end_date < timezone.localdate(now):
            reasons.append('expired')
        if self.event_status in {'cancelled', 'postponed'}:
            reasons.append(self.event_status)
        if freshness_status in {'unknown', 'stale'}:
            reasons.append('page_not_fresh')

        self.officiality_score = officiality
        self.completeness_score = completeness
        self.freshness_score = freshness
        self.date_consistency_score = date_consistency
        self.score = overall
        self.freshness_status = freshness_status
        self.confidence_explanation = {
            'version': 'campus-radar-v1',
            'weights': {'officiality': 0.35, 'completeness': 0.25, 'freshness': 0.20, 'date_consistency': 0.20},
            'subscores': {
                'officiality': officiality,
                'completeness': completeness,
                'freshness': freshness,
                'date_consistency': date_consistency,
            },
            'overall': overall,
        }
        self.verification_queue_reasons = list(dict.fromkeys(reasons))
        if reasons:
            self.verification_status = 'pending'
            self.verification_requested_at = self.verification_requested_at or now
            self.verified_at = None
            self.verified_by = ''
        return self.confidence_explanation

    def mark_verified(self, *, reviewer, note='', reference_time=None):
        now = reference_time or timezone.now()
        self.refresh_radar_assessment(reference_time=now)
        blocking = {'date_conflict', 'expired', 'cancelled', 'postponed'} & set(self.verification_queue_reasons)
        if blocking:
            raise ValidationError({'verification_status': f'Blocking radar findings must be resolved: {sorted(blocking)}'})
        if not reviewer:
            raise ValidationError({'verified_by': 'A named human reviewer is required.'})
        self.verification_status = 'verified'
        self.verification_queue_reasons = []
        self.verified_by = reviewer
        self.verified_at = now
        self.verification_note = note

    def mark_rejected(self, *, reviewer, note):
        if not reviewer or not note:
            raise ValidationError({'verification_status': 'Rejection requires a reviewer and reason.'})
        self.verification_status = 'rejected'
        self.verified_by = reviewer
        self.verified_at = timezone.now()
        self.verification_note = note

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'source_url'], name='unique_workspace_event_source'),
        ]
        verbose_name = '高校活动'
        verbose_name_plural = '高校活动'

    def __str__(self):
        date_str = self.event_date.strftime('%Y-%m-%d') if self.event_date else '待定'
        return f'[{self.category}] {self.title} — {self.university} ({date_str})'


class EventReview(models.Model):
    """
    活动回顾文章

    支持手动提交和 Twitter 自动采集两种来源。
    tweet_id 用于 Twitter 来源去重（手动文章为 NULL）。
    """
    SOURCE_CHOICES = [
        ('manual', '手动提交'),
        ('twitter', 'Twitter'),
    ]

    workspace = models.ForeignKey(
        Workspace, on_delete=models.PROTECT, related_name='event_reviews', default=1, verbose_name='工作区',
    )
    title = models.CharField(max_length=500, verbose_name='标题')
    content = models.TextField(verbose_name='正文内容')
    summary = models.TextField(blank=True, default='', verbose_name='AI 摘要')
    source_type = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default='manual',
        verbose_name='来源类型'
    )
    source_url = models.URLField(max_length=500, blank=True, default='', verbose_name='来源链接')
    tweet_id = models.CharField(
        max_length=100, blank=True, default='', unique=True, null=True,
        verbose_name='推文ID（去重键）'
    )
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='发布时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='收录时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '活动回顾'
        verbose_name_plural = '活动回顾'

    def __str__(self):
        return f'[{self.get_source_type_display()}] {self.title[:60]}'

    def to_content_item_snapshot(self):
        """Compatibility read model for DATA-5 legacy manual reviews."""
        return {
            'legacy_type': 'event_review',
            'legacy_id': self.id,
            'source_platform': self.source_type,
            'source_url': self.source_url,
            'external_id': self.tweet_id or '',
            'raw_text': self.content,
            'suggested_title': self.title,
            'suggested_text': self.summary,
            'published_at': self.published_at,
            'fetched_at': self.created_at,
            'review_status': 'approved' if self.source_type == 'manual' else 'needs_review',
            'risk_labels': [],
        }


class TweetReview(models.Model):
    """
    Twitter 推文回顾

    从 @TreefinanceCN 推文采集，经 DeepSeek AI 分析后筛选入库。
    支持图片展示 + AI 润色敏感文案。
    """
    workspace = models.ForeignKey(
        Workspace, on_delete=models.PROTECT, related_name='tweet_reviews', default=1, verbose_name='工作区',
    )
    tweet_id = models.CharField(max_length=50, unique=True, verbose_name='推文 ID')
    text = models.TextField(verbose_name='原始文案')
    text_processed = models.TextField(blank=True, default='', verbose_name='AI 润色后文案')
    media_urls = models.TextField(blank=True, default='[]', verbose_name='图片 URL 列表 (JSON)')
    twitter_url = models.URLField(max_length=500, verbose_name='推文链接')
    summary = models.TextField(blank=True, default='', verbose_name='AI 摘要')
    is_review_worthy = models.BooleanField(default=False, verbose_name='是否高校行相关')
    is_sensitive = models.BooleanField(default=False, verbose_name='是否含敏感文案')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='推文发布时间')
    raw_data = models.TextField(blank=True, default='', verbose_name='原始 JSON')
    space_url = models.URLField(max_length=500, blank=True, default='', verbose_name='Space 语音链接')
    space_summary = models.TextField(blank=True, default='', verbose_name='Space 语音总结')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='收录时间')

    class Meta:
        ordering = ['-published_at']
        verbose_name = '推文回顾'
        verbose_name_plural = '推文回顾'

    def __str__(self):
        return f'[推文] {self.text[:60]}'

    def to_content_item_snapshot(self):
        """Compatibility read model for DATA-5.

        The legacy TweetReview table remains readable while the new content
        relay model is introduced. This method is intentionally side-effect
        free: it does not mutate the immutable raw tweet or create a new row.
        """
        return {
            'legacy_type': 'tweet_review',
            'legacy_id': self.id,
            'source_platform': 'x',
            'source_url': self.twitter_url,
            'external_id': self.tweet_id,
            'raw_text': self.text,
            'suggested_text': self.text_processed,
            'summary': self.summary,
            'published_at': self.published_at,
            'fetched_at': self.created_at,
            'review_status': 'needs_review' if not self.is_review_worthy else 'approved',
            'risk_labels': ['sensitive_copy'] if self.is_sensitive else [],
        }


class SourceConnector(models.Model):
    """DATA-1: configured source with cursor, budget, owner, and status."""

    PLATFORM_CHOICES = [
        ('x', 'X / Twitter'),
        ('wechat', 'WeChat Official Account'),
        ('website', 'Website / RSS'),
        ('campus', 'Campus Source'),
        ('manual', 'Manual Import'),
    ]
    AUTH_MODE_CHOICES = [
        ('none', 'No auth / public'),
        ('api_key_ref', 'Server secret reference'),
        ('oauth_ref', 'OAuth secret reference'),
        ('manual_upload', 'Manual upload'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('blocked', 'Blocked'),
    ]

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='source_connectors', default=1, verbose_name='工作区',
    )
    name = models.CharField(max_length=160, verbose_name='连接器名称')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, verbose_name='平台')
    account_or_site = models.CharField(max_length=300, blank=True, default='', verbose_name='账号/站点')
    auth_mode = models.CharField(max_length=30, choices=AUTH_MODE_CHOICES, default='none', verbose_name='授权方式')
    secret_ref = models.CharField(max_length=200, blank=True, default='', verbose_name='服务端密钥引用')
    frequency = models.CharField(max_length=80, default='daily', verbose_name='抓取频率')
    cursor = models.CharField(max_length=500, blank=True, default='', verbose_name='增量游标')
    daily_budget_cents = models.PositiveIntegerField(default=0, verbose_name='单日预算（分）')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='paused', verbose_name='状态')
    owner = models.CharField(max_length=120, verbose_name='负责人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['platform', 'name']
        verbose_name = '来源连接器'
        verbose_name_plural = '来源连接器'

    def __str__(self):
        return f'{self.platform}:{self.name}'


class IngestionRun(models.Model):
    """DATA-2: observable ingestion execution record."""

    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('running', 'Running'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('retrying', 'Retrying'),
    ]

    connector = models.ForeignKey(
        SourceConnector,
        on_delete=models.PROTECT,
        related_name='runs',
        verbose_name='来源连接器',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled', verbose_name='状态')
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='计划时间')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='开始时间')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='结束时间')
    cursor_before = models.CharField(max_length=500, blank=True, default='', verbose_name='运行前游标')
    cursor_after = models.CharField(max_length=500, blank=True, default='', verbose_name='运行后游标')
    collected_count = models.PositiveIntegerField(default=0, verbose_name='采集数量')
    new_count = models.PositiveIntegerField(default=0, verbose_name='新增数量')
    duplicate_count = models.PositiveIntegerField(default=0, verbose_name='重复数量')
    failed_count = models.PositiveIntegerField(default=0, verbose_name='失败数量')
    duration_ms = models.PositiveIntegerField(default=0, verbose_name='耗时毫秒')
    model_cost_cents = models.PositiveIntegerField(default=0, verbose_name='模型成本（分）')
    retry_count = models.PositiveIntegerField(default=0, verbose_name='重试次数')
    error_code = models.CharField(max_length=120, blank=True, default='', verbose_name='错误码')
    error_message = models.TextField(blank=True, default='', verbose_name='错误摘要')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '采集运行'
        verbose_name_plural = '采集运行'

    def __str__(self):
        return f'{self.connector_id}:{self.status}:{self.created_at:%Y-%m-%d %H:%M}'


class ContentItem(models.Model):
    """DATA-3: immutable source content and cross-source clustering anchor."""

    PLATFORM_CHOICES = SourceConnector.PLATFORM_CHOICES
    MEDIA_LICENSE_CHOICES = [
        ('unknown', 'Unknown'),
        ('licensed', 'Licensed'),
        ('link_only', 'Link only'),
        ('rejected', 'Rejected'),
    ]

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='content_items', default=1, verbose_name='工作区',
    )
    connector = models.ForeignKey(
        SourceConnector,
        on_delete=models.SET_NULL,
        related_name='content_items',
        null=True,
        blank=True,
        verbose_name='来源连接器',
    )
    ingestion_run = models.ForeignKey(
        IngestionRun,
        on_delete=models.SET_NULL,
        related_name='content_items',
        null=True,
        blank=True,
        verbose_name='采集运行',
    )
    source_platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, verbose_name='来源平台')
    source_url = models.URLField(max_length=800, verbose_name='来源 URL')
    external_id = models.CharField(max_length=200, blank=True, default='', verbose_name='外部 ID')
    publisher = models.CharField(max_length=200, blank=True, default='', verbose_name='发布者')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='发布时间')
    fetched_at = models.DateTimeField(null=True, blank=True, verbose_name='抓取/核验时间')
    raw_text = models.TextField(verbose_name='不可变原文')
    normalized_text = models.TextField(blank=True, default='', verbose_name='规范化文本')
    content_hash = models.CharField(max_length=128, verbose_name='内容哈希')
    cluster_key = models.CharField(max_length=128, blank=True, default='', db_index=True, verbose_name='聚类键')
    topic_scores = models.JSONField(default=dict, blank=True, verbose_name='主题分数')
    media_urls = models.JSONField(default=list, blank=True, verbose_name='媒体引用')
    media_license_status = models.CharField(
        max_length=20,
        choices=MEDIA_LICENSE_CHOICES,
        default='unknown',
        verbose_name='媒体授权状态',
    )
    source_metadata = models.JSONField(default=dict, blank=True, verbose_name='来源元数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        ordering = ['-published_at', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'content_hash'], name='unique_workspace_content_hash'),
        ]
        verbose_name = '内容条目'
        verbose_name_plural = '内容条目'

    def __str__(self):
        return f'{self.source_platform}:{self.content_hash[:12]}'


class EditorialReview(models.Model):
    """DATA-4: review state, risk labels, AI suggestion, diff, and publication."""

    STATUS_CHOICES = [
        ('collected', 'Collected'),
        ('classified', 'Classified'),
        ('needs_review', 'Needs review'),
        ('approved', 'Approved'),
        ('published', 'Published'),
        ('rejected', 'Rejected'),
    ]
    ALLOWED_TRANSITIONS = {
        'collected': {'classified', 'needs_review', 'rejected'},
        'classified': {'needs_review', 'approved', 'rejected'},
        'needs_review': {'approved', 'rejected'},
        'approved': {'published', 'needs_review', 'rejected'},
        'published': {'needs_review'},
        'rejected': set(),
    }

    content_item = models.OneToOneField(
        ContentItem,
        on_delete=models.CASCADE,
        related_name='editorial_review',
        verbose_name='内容条目',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='collected', verbose_name='状态')
    classification = models.JSONField(default=dict, blank=True, verbose_name='分类结果')
    risk_labels = models.JSONField(default=list, blank=True, verbose_name='风险标签')
    suggested_title = models.CharField(max_length=500, blank=True, default='', verbose_name='建议标题')
    suggested_text = models.TextField(blank=True, default='', verbose_name='建议稿')
    diff_summary = models.TextField(blank=True, default='', verbose_name='变更 diff 摘要')
    source_refs = models.JSONField(default=list, blank=True, verbose_name='事实引用')
    model_version = models.CharField(max_length=120, blank=True, default='', verbose_name='模型/规则版本')
    reviewer = models.CharField(max_length=120, blank=True, default='', verbose_name='审核人')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='发布时间')
    rejection_reason = models.TextField(blank=True, default='', verbose_name='驳回原因')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['-updated_at']
        verbose_name = '编辑审核'
        verbose_name_plural = '编辑审核'

    def can_transition_to(self, next_status):
        return next_status in self.ALLOWED_TRANSITIONS.get(self.status, set())

    def clean(self):
        super().clean()
        if self.status == 'published':
            if not self.reviewer or not self.reviewed_at:
                raise ValidationError({
                    'status': 'Published content requires a named human reviewer and reviewed_at.',
                })
            if not self.source_refs:
                raise ValidationError({
                    'source_refs': 'Published content must keep at least one source reference.',
                })
            if 'human_review_required' in (self.risk_labels or []) and not self.diff_summary:
                raise ValidationError({
                    'diff_summary': 'High-risk published content requires an auditable diff summary.',
                })
        if not self.pk:
            return
        previous = type(self).objects.filter(pk=self.pk).only('status').first()
        if (
            previous
            and previous.status != self.status
            and self.status not in self.ALLOWED_TRANSITIONS.get(previous.status, set())
        ):
            raise ValidationError({
                'status': f'Illegal editorial transition: {previous.status} -> {self.status}',
            })

    def transition_to(self, next_status):
        if not self.can_transition_to(next_status):
            raise ValidationError({
                'status': f'Illegal editorial transition: {self.status} -> {next_status}',
            })
        self.status = next_status

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.content_item_id}:{self.status}'


class OutreachDraft(models.Model):
    """
    外联审批草稿

    每封 AI 生成的合作邀请邮件对应一条记录，需人工审批后才能发送。
    """
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('awaiting_approval', '待审批'),
        ('approved', '已批准'),
        ('rejected', '已驳回'),
    ]

    workspace = models.ForeignKey(
        Workspace, on_delete=models.PROTECT, related_name='outreach_drafts', default=1, verbose_name='工作区',
    )
    university_event = models.ForeignKey(
        UniversityEvent, on_delete=models.CASCADE,
        related_name='outreach_drafts', verbose_name='关联活动',
    )
    subject = models.CharField(max_length=300, blank=True, default='', verbose_name='邮件主题')
    email_body = models.TextField(verbose_name='邮件正文')
    recipient_email = models.CharField(max_length=200, blank=True, default='', verbose_name='收件人邮箱')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='draft',
        verbose_name='审批状态',
    )
    approved_by = models.CharField(max_length=100, blank=True, default='', verbose_name='审批人')
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')

    # 链上存证
    proof_tx_hash = models.CharField(max_length=200, blank=True, default='', verbose_name='链上交易哈希')
    proof_network = models.CharField(max_length=50, blank=True, default='', verbose_name='链上网络')
    proof_explorer_url = models.URLField(max_length=500, blank=True, default='', verbose_name='浏览器链接')
    proof_created_at = models.DateTimeField(null=True, blank=True, verbose_name='凭证生成时间')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '外联草稿'
        verbose_name_plural = '外联草稿'

    ALLOWED_TRANSITIONS = {
        None: {'draft'},
        'draft': {'awaiting_approval', 'approved', 'rejected'},
        'awaiting_approval': {'approved', 'rejected'},
        'approved': set(),
        'rejected': set(),
    }

    def __str__(self):
        return f'[{self.get_status_display()}] {self.university_event.university} — {self.university_event.title[:40]}'

    def can_transition_to(self, next_status):
        return next_status in self.ALLOWED_TRANSITIONS.get(self.status, set())

    def clean(self):
        super().clean()
        if not self.pk:
            return
        previous = type(self).objects.filter(pk=self.pk).only('status').first()
        if (
            previous
            and previous.status != self.status
            and self.status not in self.ALLOWED_TRANSITIONS.get(previous.status, set())
        ):
            raise ValidationError({
                'status': f'Illegal outreach transition: {previous.status} -> {self.status}',
            })

    def transition_to(self, next_status):
        if not self.can_transition_to(next_status):
            raise ValidationError({
                'status': f'Illegal outreach transition: {self.status} -> {next_status}',
            })
        self.status = next_status

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ContactPoint(models.Model):
    """DATA-6: an evidenced, purpose-limited public event contact."""

    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('contact_page', 'Public contact page'),
        ('phone', 'Phone'),
        ('wechat', 'WeChat'),
        ('qq', 'QQ'),
    ]
    PURPOSE_CHOICES = [
        ('event', 'Event coordination'),
        ('collaboration', 'Collaboration'),
        ('media', 'Media'),
        ('general', 'General public enquiry'),
    ]
    VERIFICATION_CHOICES = [
        ('unverified', 'Unverified'),
        ('verified', 'Verified public business contact'),
        ('stale', 'Stale / needs re-verification'),
        ('opted_out', 'Opted out'),
        ('suppressed', 'Suppressed'),
    ]

    university_event = models.ForeignKey(
        UniversityEvent, on_delete=models.CASCADE, related_name='contact_points', verbose_name='关联活动',
    )
    channel = models.CharField(max_length=30, choices=CHANNEL_CHOICES, verbose_name='联系方式类型')
    value = models.CharField(max_length=500, verbose_name='联系值')
    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES, verbose_name='用途')
    evidence_url = models.URLField(max_length=800, verbose_name='公开证据 URL')
    first_verified_at = models.DateTimeField(default=timezone.now, verbose_name='首次核验时间')
    last_verified_at = models.DateTimeField(default=timezone.now, verbose_name='最近核验时间')
    confidence = models.PositiveSmallIntegerField(default=0, validators=SCORE_VALIDATORS, verbose_name='可信度 (0-100)')
    verification_status = models.CharField(
        max_length=20, choices=VERIFICATION_CHOICES, default='unverified', verbose_name='核验/退订状态',
    )
    is_public_business_contact = models.BooleanField(default=False, verbose_name='公开机构/活动联系方式')
    is_mock = models.BooleanField(default=False, verbose_name='演示联系人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['university_event', 'channel', 'value']
        constraints = [
            models.UniqueConstraint(
                fields=['university_event', 'channel', 'value'], name='unique_event_contact_channel_value',
            ),
        ]
        verbose_name = '活动公开联系点'
        verbose_name_plural = '活动公开联系点'

    def clean(self):
        super().clean()
        if self.first_verified_at and self.last_verified_at and self.last_verified_at < self.first_verified_at:
            raise ValidationError({'last_verified_at': 'Last verification cannot precede first verification.'})
        if self.verification_status == 'verified' and not self.is_public_business_contact:
            raise ValidationError({
                'is_public_business_contact': 'A verified contact must be an evidenced public business contact.',
            })
        if self.channel == 'email' and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', self.value or ''):
            raise ValidationError({'value': 'Email contact points must contain a valid email address.'})
        if self.channel == 'contact_page' and not re.match(r'^https?://', self.value or ''):
            raise ValidationError({'value': 'Contact page values must be an absolute public URL.'})

    @property
    def is_usable_for_live_outreach(self):
        return bool(
            self.verification_status == 'verified'
            and self.is_public_business_contact
            and not self.is_mock
            and self.evidence_url
            and self.last_verified_at
        )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.university_event_id}:{self.channel}:{self.purpose}'


class CollaborationMatch(models.Model):
    """DATA-7: explainable event/campaign matching with cited sub-scores."""

    STATUS_CHOICES = [
        ('suggested', 'Suggested'),
        ('verified', 'Human verified'),
        ('rejected', 'Rejected'),
    ]
    SCORE_DIMENSIONS = (
        'theme', 'audience', 'timing', 'city', 'resources', 'information',
    )
    ALLOWED_TRANSITIONS = {
        'suggested': {'verified', 'rejected'},
        'verified': {'rejected'},
        'rejected': set(),
    }

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='collaboration_matches', verbose_name='工作区',
    )
    event = models.ForeignKey(
        UniversityEvent, on_delete=models.CASCADE, related_name='collaboration_matches', verbose_name='高校活动',
    )
    campaign_key = models.CharField(max_length=120, verbose_name='Campaign 标识')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='suggested', verbose_name='状态')
    overall_score = models.PositiveSmallIntegerField(validators=SCORE_VALIDATORS, verbose_name='总分')
    theme_score = models.PositiveSmallIntegerField(validators=SCORE_VALIDATORS, verbose_name='主题分')
    audience_score = models.PositiveSmallIntegerField(validators=SCORE_VALIDATORS, verbose_name='受众分')
    timing_score = models.PositiveSmallIntegerField(validators=SCORE_VALIDATORS, verbose_name='时间分')
    city_score = models.PositiveSmallIntegerField(validators=SCORE_VALIDATORS, verbose_name='城市分')
    resource_score = models.PositiveSmallIntegerField(validators=SCORE_VALIDATORS, verbose_name='资源分')
    information_score = models.PositiveSmallIntegerField(validators=SCORE_VALIDATORS, verbose_name='信息完整度分')
    fit_points = models.JSONField(default=list, blank=True, verbose_name='契合点')
    missing_information = models.JSONField(default=list, blank=True, verbose_name='缺失信息')
    conflicts = models.JSONField(default=list, blank=True, verbose_name='冲突项')
    citations = models.JSONField(default=list, verbose_name='证据引用')
    score_citations = models.JSONField(default=dict, verbose_name='分项评分引用')
    scoring_version = models.CharField(max_length=80, verbose_name='评分规则版本')
    model_version = models.CharField(max_length=120, verbose_name='模型/规则版本')
    reviewed_by = models.CharField(max_length=120, blank=True, default='', verbose_name='审核人')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['-overall_score', '-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'event', 'campaign_key', 'scoring_version'],
                name='unique_workspace_event_campaign_scoring',
            ),
        ]
        verbose_name = '合作匹配'
        verbose_name_plural = '合作匹配'

    def clean(self):
        super().clean()
        if self.event_id and self.workspace_id and self.event.workspace_id != self.workspace_id:
            raise ValidationError({'workspace': 'Match workspace must equal the event workspace.'})
        for field_name in ('fit_points', 'missing_information', 'conflicts'):
            _validate_string_list(getattr(self, field_name), field_name)
        if not isinstance(self.citations, list) or not self.citations:
            raise ValidationError({'citations': 'At least one event or capability citation is required.'})
        citation_ids = set()
        for citation in self.citations:
            if not isinstance(citation, dict):
                raise ValidationError({'citations': 'Each citation must be an object.'})
            citation_id = citation.get('id')
            if not isinstance(citation_id, str) or not citation_id.strip() or citation_id in citation_ids:
                raise ValidationError({'citations': 'Citation ids must be non-empty and unique.'})
            normalized_type = citation.get('source_type') or citation.get('type')
            source_id = citation.get('source_id') or citation_id.partition(':')[2]
            if normalized_type not in {'event', 'capability', 'event_source', 'approved_capability'} or not source_id:
                raise ValidationError({'citations': 'Citations must resolve to an event or approved capability.'})
            citation_ids.add(citation_id)
        if not isinstance(self.score_citations, dict) or set(self.score_citations) != set(self.SCORE_DIMENSIONS):
            raise ValidationError({'score_citations': 'Every scoring dimension must have its own citations.'})
        for dimension, references in self.score_citations.items():
            if not isinstance(references, list) or not references or any(ref not in citation_ids for ref in references):
                raise ValidationError({'score_citations': f'{dimension} must cite one or more known citation ids.'})
        if self.status == 'verified' and (not self.reviewed_by or not self.reviewed_at):
            raise ValidationError({'status': 'Verified matches require a named human reviewer and reviewed_at.'})
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).only('status').first()
            if previous and previous.status != self.status and self.status not in self.ALLOWED_TRANSITIONS.get(previous.status, set()):
                raise ValidationError({'status': f'Illegal match transition: {previous.status} -> {self.status}'})

    def transition_to(self, next_status, reviewer=''):
        if next_status not in self.ALLOWED_TRANSITIONS.get(self.status, set()):
            raise ValidationError({'status': f'Illegal match transition: {self.status} -> {next_status}'})
        self.status = next_status
        if next_status == 'verified':
            if not reviewer:
                raise ValidationError({'reviewed_by': 'A named human reviewer is required.'})
            self.reviewed_by = reviewer
            self.reviewed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.campaign_key}:{self.event_id}:{self.overall_score}'


class Proposal(models.Model):
    """DATA-8: versioned, reusable three-tier cooperation proposal."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('awaiting_approval', 'Awaiting approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('superseded', 'Superseded'),
    ]
    ALLOWED_TRANSITIONS = {
        'draft': {'awaiting_approval', 'rejected', 'superseded'},
        'awaiting_approval': {'approved', 'rejected', 'draft', 'superseded'},
        'approved': {'superseded'},
        'rejected': {'draft', 'superseded'},
        'superseded': set(),
    }

    match = models.ForeignKey(
        CollaborationMatch, on_delete=models.CASCADE, related_name='proposals', verbose_name='合作匹配',
    )
    version = models.PositiveIntegerField(default=1, verbose_name='版本')
    previous_version = models.OneToOneField(
        'self', on_delete=models.PROTECT, related_name='next_version', null=True, blank=True, verbose_name='上一版本',
    )
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='draft', verbose_name='审批状态')
    packages = models.JSONField(default=list, verbose_name='轻/中/深三档合作包')
    partner_value = models.TextField(blank=True, default='', verbose_name='合作方价值')
    workspace_value = models.TextField(blank=True, default='', verbose_name='工作区价值')
    resources = models.JSONField(default=list, blank=True, verbose_name='资源清单')
    pending_questions = models.JSONField(default=list, blank=True, verbose_name='待确认项')
    risks = models.JSONField(default=list, blank=True, verbose_name='风险')
    source_refs = models.JSONField(default=list, verbose_name='事实来源引用')
    evidence = models.JSONField(default=list, verbose_name='结论与引用映射')
    guardrail_checks = models.JSONField(default=dict, verbose_name='合规检查')
    edit_summary = models.TextField(blank=True, default='', verbose_name='人工编辑摘要')
    edited_by = models.CharField(max_length=120, blank=True, default='', verbose_name='编辑人')
    approved_by = models.CharField(max_length=120, blank=True, default='', verbose_name='审批人')
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    rejection_reason = models.TextField(blank=True, default='', verbose_name='驳回原因')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['match', '-version']
        constraints = [
            models.UniqueConstraint(fields=['match', 'version'], name='unique_match_proposal_version'),
        ]
        verbose_name = '合作提案'
        verbose_name_plural = '合作提案'

    def clean(self):
        super().clean()
        if self.version < 1:
            raise ValidationError({'version': 'Proposal versions start at 1.'})
        if self.version == 1 and self.previous_version_id:
            raise ValidationError({'previous_version': 'Version 1 cannot have a previous version.'})
        if self.version > 1:
            if not self.previous_version_id:
                raise ValidationError({'previous_version': 'Versioned proposals must link to the prior version.'})
            if self.previous_version.match_id != self.match_id or self.previous_version.version != self.version - 1:
                raise ValidationError({'previous_version': 'Previous version must be version - 1 for the same match.'})
        if not isinstance(self.packages, list) or len(self.packages) != 3:
            raise ValidationError({'packages': 'Proposal must contain exactly light, medium, and deep packages.'})
        package_names = []
        for package in self.packages:
            if not isinstance(package, dict):
                raise ValidationError({'packages': 'Each package must be an object.'})
            if any(key not in package for key in ('name', 'value', 'resources', 'nextStep')):
                raise ValidationError({'packages': 'Each package requires name, value, resources, and nextStep.'})
            if not isinstance(package.get('resources'), list):
                raise ValidationError({'packages': 'Package resources must be a list.'})
            package_names.append(package.get('name'))
        if package_names != ['light', 'medium', 'deep']:
            raise ValidationError({'packages': 'Packages must be ordered light, medium, deep.'})
        for field_name in ('resources', 'pending_questions', 'risks', 'source_refs'):
            _validate_string_list(getattr(self, field_name), field_name, allow_empty=field_name not in {'source_refs'})
        if not isinstance(self.evidence, list) or not self.evidence:
            raise ValidationError({'evidence': 'Proposal claims require evidence mappings.'})
        known_refs = set(self.source_refs)
        for claim in self.evidence:
            if not isinstance(claim, dict) or not (claim.get('claim_id') or claim.get('claimId')) or not claim.get('claim'):
                raise ValidationError({'evidence': 'Each evidence item requires claimId and claim.'})
            refs = claim.get('source_refs') or claim.get('sourceIds')
            if not isinstance(refs, list) or not refs or any(ref not in known_refs for ref in refs):
                raise ValidationError({'evidence': 'Every proposal claim must cite known source_refs.'})
        required_guardrails = {'noUnapprovedPrize', 'noGuaranteedExposure', 'humanApprovalRequired'}
        if not isinstance(self.guardrail_checks, dict) or not required_guardrails.issubset(self.guardrail_checks):
            raise ValidationError({'guardrail_checks': 'Required proposal guardrails are missing.'})
        if self.status == 'approved':
            if not self.approved_by or not self.approved_at:
                raise ValidationError({'status': 'Approved proposals require a named approver and approved_at.'})
            if self.match.status != 'verified':
                raise ValidationError({'match': 'Only a human-verified match can have an approved proposal.'})
            if not all(self.guardrail_checks.get(key) is True for key in required_guardrails):
                raise ValidationError({'guardrail_checks': 'All guardrails must pass before approval.'})
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).only('status', 'version', 'match_id').first()
            if previous and (previous.version != self.version or previous.match_id != self.match_id):
                raise ValidationError({'version': 'Proposal identity/version is immutable; create a new version.'})
            if previous and previous.status != self.status and self.status not in self.ALLOWED_TRANSITIONS.get(previous.status, set()):
                raise ValidationError({'status': f'Illegal proposal transition: {previous.status} -> {self.status}'})

    def transition_to(self, next_status):
        if next_status not in self.ALLOWED_TRANSITIONS.get(self.status, set()):
            raise ValidationError({'status': f'Illegal proposal transition: {self.status} -> {next_status}'})
        self.status = next_status

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.match_id}:v{self.version}:{self.status}'


class OutreachBatch(models.Model):
    """DATA-9: human-approved, rate-limited collection of individual messages."""

    STATUS_CHOICES = [
        ('draft', 'Draft'), ('awaiting_approval', 'Awaiting approval'), ('approved', 'Approved'),
        ('scheduled', 'Scheduled'), ('running', 'Running'), ('completed', 'Completed'),
        ('stopped', 'Stopped'), ('failed', 'Failed'),
    ]
    ALLOWED_TRANSITIONS = {
        'draft': {'awaiting_approval', 'stopped'},
        'awaiting_approval': {'approved', 'draft', 'stopped'},
        'approved': {'scheduled', 'running', 'stopped'},
        'scheduled': {'running', 'stopped'},
        'running': {'completed', 'stopped', 'failed'},
        'failed': {'running', 'stopped'},
        'completed': set(), 'stopped': set(),
    }

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='outreach_batches', verbose_name='工作区',
    )
    name = models.CharField(max_length=200, verbose_name='批次名称')
    selection_criteria = models.JSONField(default=dict, blank=True, verbose_name='筛选条件')
    target_count = models.PositiveIntegerField(default=0, verbose_name='目标数量')
    rate_limit_per_hour = models.PositiveIntegerField(default=10, verbose_name='每小时上限')
    daily_limit = models.PositiveIntegerField(default=30, verbose_name='每日上限')
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    created_by = models.CharField(max_length=120, verbose_name='创建人')
    approved_by = models.CharField(max_length=120, blank=True, default='', verbose_name='审批人')
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='计划发送时间')
    stop_requested = models.BooleanField(default=False, verbose_name='立即停止')
    stop_reason = models.TextField(blank=True, default='', verbose_name='停止原因')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '外联批次'
        verbose_name_plural = '外联批次'

    def clean(self):
        super().clean()
        if self.rate_limit_per_hour < 1 or self.daily_limit < 1:
            raise ValidationError({'rate_limit_per_hour': 'Rate and daily limits must be positive.'})
        if self.status in {'approved', 'scheduled', 'running', 'completed', 'failed'} and (not self.approved_by or not self.approved_at):
            raise ValidationError({'status': 'Dispatch-capable batches require human approval.'})
        if self.status == 'scheduled' and not self.scheduled_at:
            raise ValidationError({'scheduled_at': 'Scheduled batches require scheduled_at.'})
        if (self.stop_requested or self.status == 'stopped') and not self.stop_reason:
            raise ValidationError({'stop_reason': 'Stopped batches require a reason.'})
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).only('status').first()
            if previous and previous.status != self.status and self.status not in self.ALLOWED_TRANSITIONS.get(previous.status, set()):
                raise ValidationError({'status': f'Illegal batch transition: {previous.status} -> {self.status}'})

    def transition_to(self, next_status):
        if next_status not in self.ALLOWED_TRANSITIONS.get(self.status, set()):
            raise ValidationError({'status': f'Illegal batch transition: {self.status} -> {next_status}'})
        self.status = next_status

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class OutreachMessage(models.Model):
    """DATA-9: one school, one approved message, one idempotency key."""

    STATUS_CHOICES = [
        ('draft', 'Draft'), ('awaiting_approval', 'Awaiting approval'), ('approved', 'Approved'),
        ('queued', 'Queued'), ('sending', 'Sending'), ('sent', 'Sent'), ('failed', 'Failed'),
        ('bounced', 'Bounced'), ('unsubscribed', 'Unsubscribed'), ('suppressed', 'Suppressed'),
        ('cancelled', 'Cancelled'),
    ]
    PROVIDER_STATUS_CHOICES = [
        ('none', 'Not submitted'), ('pending', 'Pending'), ('accepted', 'Accepted'),
        ('delivered', 'Delivered'), ('deferred', 'Deferred'), ('bounced', 'Bounced'),
        ('rejected', 'Rejected'), ('complained', 'Complaint'), ('unsubscribed', 'Unsubscribed'),
    ]
    ALLOWED_TRANSITIONS = {
        'draft': {'awaiting_approval', 'cancelled', 'suppressed'},
        'awaiting_approval': {'approved', 'draft', 'cancelled', 'suppressed'},
        'approved': {'queued', 'cancelled', 'suppressed'},
        'queued': {'sending', 'cancelled', 'suppressed'},
        'sending': {'sent', 'failed', 'bounced', 'suppressed'},
        'failed': {'queued', 'cancelled', 'suppressed'},
        'sent': {'bounced', 'unsubscribed'},
        'bounced': set(), 'unsubscribed': set(), 'suppressed': set(), 'cancelled': set(),
    }

    batch = models.ForeignKey(OutreachBatch, on_delete=models.CASCADE, related_name='messages', verbose_name='外联批次')
    university_event = models.ForeignKey(
        UniversityEvent, on_delete=models.PROTECT, related_name='outreach_messages', verbose_name='目标高校活动',
    )
    university_key = models.CharField(max_length=240, editable=False, verbose_name='规范化高校幂等键')
    proposal = models.ForeignKey(Proposal, on_delete=models.PROTECT, related_name='outreach_messages', verbose_name='提案')
    proposal_version = models.PositiveIntegerField(verbose_name='提案版本快照')
    contact_point = models.ForeignKey(
        ContactPoint, on_delete=models.PROTECT, related_name='outreach_messages', verbose_name='联系证据',
    )
    contact_evidence_url = models.URLField(max_length=800, verbose_name='联系证据 URL 快照')
    contact_verified_at = models.DateTimeField(verbose_name='联系证据核验时间快照')
    idempotency_key = models.CharField(max_length=160, unique=True, verbose_name='发送幂等键')
    subject = models.CharField(max_length=300, verbose_name='主题')
    body = models.TextField(verbose_name='个性化正文')
    personalization = models.JSONField(default=list, blank=True, verbose_name='个性化依据')
    citation_ids = models.JSONField(default=list, verbose_name='事实引用')
    guardrail_checks = models.JSONField(default=dict, verbose_name='外联合规检查')
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    approved_by = models.CharField(max_length=120, blank=True, default='', verbose_name='审批人')
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    provider = models.CharField(max_length=80, blank=True, default='', verbose_name='Provider')
    provider_status = models.CharField(
        max_length=24, choices=PROVIDER_STATUS_CHOICES, default='none', verbose_name='Provider 状态',
    )
    provider_message_id = models.CharField(max_length=200, blank=True, default='', verbose_name='Provider 消息 ID')
    provider_error_code = models.CharField(max_length=120, blank=True, default='', verbose_name='Provider 错误码')
    provider_error_message = models.TextField(blank=True, default='', verbose_name='Provider 错误摘要')
    retry_count = models.PositiveIntegerField(default=0, verbose_name='重试次数')
    next_retry_at = models.DateTimeField(null=True, blank=True, verbose_name='下次重试时间')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='发送时间')
    bounced_at = models.DateTimeField(null=True, blank=True, verbose_name='退信时间')
    unsubscribed_at = models.DateTimeField(null=True, blank=True, verbose_name='退订时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['batch', 'university_event']
        constraints = [
            models.UniqueConstraint(fields=['batch', 'university_key'], name='unique_batch_university_message'),
        ]
        verbose_name = '外联消息'
        verbose_name_plural = '外联消息'

    def clean(self):
        super().clean()
        if self.batch_id and self.university_event_id and self.batch.workspace_id != self.university_event.workspace_id:
            raise ValidationError({'university_event': 'Message target must belong to the batch workspace.'})
        if self.university_event_id:
            expected_key = re.sub(r'\s+', ' ', self.university_event.university.strip()).casefold()
            if self.university_key != expected_key:
                raise ValidationError({'university_key': 'University key must be derived from the target school.'})
        if self.proposal_id:
            if self.proposal_version != self.proposal.version:
                raise ValidationError({'proposal_version': 'Message must bind the exact proposal version.'})
            if self.university_event_id and self.proposal.match.event_id != self.university_event_id:
                raise ValidationError({'proposal': 'Proposal and message must target the same event/school.'})
        if self.contact_point_id:
            if self.university_event_id and self.contact_point.university_event_id != self.university_event_id:
                raise ValidationError({'contact_point': 'Contact evidence must belong to the target event.'})
            if self.contact_evidence_url != self.contact_point.evidence_url or self.contact_verified_at != self.contact_point.last_verified_at:
                raise ValidationError({'contact_evidence_url': 'Contact evidence snapshot must match the bound contact point.'})
        _validate_string_list(self.personalization, 'personalization')
        _validate_string_list(self.citation_ids, 'citation_ids', allow_empty=False)
        if not isinstance(self.guardrail_checks, dict):
            raise ValidationError({'guardrail_checks': 'Guardrail checks must be an object.'})
        approval_states = {'approved', 'queued', 'sending', 'sent', 'failed', 'bounced', 'unsubscribed'}
        if self.status in approval_states:
            if not self.approved_by or not self.approved_at:
                raise ValidationError({'status': 'Dispatch requires explicit message approval.'})
            if not self.batch.approved_by or not self.batch.approved_at:
                raise ValidationError({'batch': 'Dispatch requires an approved batch.'})
            if self.proposal.status != 'approved':
                raise ValidationError({'proposal': 'Dispatch requires an approved proposal version.'})
        if self.status in {'approved', 'queued', 'sending'} and (
            self.contact_point.channel != 'email' or not self.contact_point.is_usable_for_live_outreach
        ):
            raise ValidationError({'contact_point': 'Live outreach requires a verified, public, non-mock contact.'})
        if self.status in {'queued', 'sending'} and (self.batch.stop_requested or self.batch.status == 'stopped'):
            raise ValidationError({'batch': 'No message may enter the send path after an emergency stop.'})
        if self.status == 'sent' and (not self.sent_at or not self.provider_message_id or self.provider_status not in {'accepted', 'delivered'}):
            raise ValidationError({'status': 'Sent messages require provider acknowledgement and sent_at.'})
        if self.status == 'bounced' and not self.bounced_at:
            raise ValidationError({'bounced_at': 'Bounced messages require bounced_at.'})
        if self.status == 'unsubscribed' and not self.unsubscribed_at:
            raise ValidationError({'unsubscribed_at': 'Unsubscribed messages require unsubscribed_at.'})
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).only('status', 'idempotency_key', 'proposal_version').first()
            if previous and (previous.idempotency_key != self.idempotency_key or previous.proposal_version != self.proposal_version):
                raise ValidationError({'idempotency_key': 'Idempotency key and proposal version are immutable.'})
            if previous and previous.status != self.status and self.status not in self.ALLOWED_TRANSITIONS.get(previous.status, set()):
                raise ValidationError({'status': f'Illegal message transition: {previous.status} -> {self.status}'})

    def transition_to(self, next_status):
        if next_status not in self.ALLOWED_TRANSITIONS.get(self.status, set()):
            raise ValidationError({'status': f'Illegal message transition: {self.status} -> {next_status}'})
        self.status = next_status

    def save(self, *args, **kwargs):
        if self.university_event_id:
            self.university_key = re.sub(r'\s+', ' ', self.university_event.university.strip()).casefold()
        self.full_clean()
        return super().save(*args, **kwargs)


class AgentRun(models.Model):
    """DATA-10: privacy-safe model/schema trace, cost, latency, citations, and feedback."""

    STATUS_CHOICES = [
        ('queued', 'Queued'), ('running', 'Running'), ('succeeded', 'Succeeded'),
        ('failed', 'Failed'), ('fallback', 'Deterministic fallback'), ('blocked', 'Privacy blocked'),
    ]
    PRIVACY_CHOICES = [
        ('no_pii', 'No PII present'), ('redacted', 'Sensitive fields redacted'), ('blocked', 'Blocked by privacy guard'),
    ]

    run_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, verbose_name='运行 ID')
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='agent_runs', verbose_name='工作区',
    )
    task_type = models.CharField(max_length=40, verbose_name='Agent 任务类型')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued', verbose_name='状态')
    model_provider = models.CharField(max_length=80, blank=True, default='', verbose_name='模型 Provider')
    model_name = models.CharField(max_length=120, blank=True, default='', verbose_name='模型名称')
    model_version = models.CharField(max_length=120, verbose_name='模型/规则版本')
    schema_name = models.CharField(max_length=120, verbose_name='Schema 名称')
    schema_version = models.CharField(max_length=80, verbose_name='Schema 版本')
    prompt_version = models.CharField(max_length=80, blank=True, default='', verbose_name='Prompt 版本')
    input_references = models.JSONField(default=list, verbose_name='输入引用')
    citations = models.JSONField(default=list, blank=True, verbose_name='输出引用')
    input_snapshot = models.JSONField(default=dict, blank=True, verbose_name='脱敏输入快照')
    structured_output = models.JSONField(default=dict, blank=True, verbose_name='脱敏结构化输出')
    tool_calls = models.JSONField(default=list, blank=True, verbose_name='脱敏工具调用')
    input_tokens = models.PositiveIntegerField(null=True, blank=True, default=None, verbose_name='输入 token')
    output_tokens = models.PositiveIntegerField(null=True, blank=True, default=None, verbose_name='输出 token')
    cached_input_tokens = models.PositiveIntegerField(null=True, blank=True, default=None, verbose_name='缓存输入 token')
    latency_ms = models.PositiveIntegerField(default=0, verbose_name='延迟毫秒')
    cost_microusd = models.PositiveBigIntegerField(null=True, blank=True, default=None, verbose_name='成本 (micro USD)')
    retry_count = models.PositiveIntegerField(default=0, verbose_name='重试次数')
    cache_hit = models.BooleanField(default=False, verbose_name='缓存命中')
    privacy_status = models.CharField(max_length=20, choices=PRIVACY_CHOICES, default='no_pii', verbose_name='隐私状态')
    redacted_fields = models.JSONField(default=list, blank=True, verbose_name='脱敏字段')
    error_code = models.CharField(max_length=120, blank=True, default='', verbose_name='错误码')
    error_message = models.TextField(blank=True, default='', verbose_name='脱敏错误摘要')
    human_feedback = models.JSONField(default=dict, blank=True, verbose_name='人工反馈')
    feedback_by = models.CharField(max_length=120, blank=True, default='', verbose_name='反馈人')
    feedback_at = models.DateTimeField(null=True, blank=True, verbose_name='反馈时间')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='开始时间')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='结束时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Agent 运行'
        verbose_name_plural = 'Agent 运行'

    @property
    def total_tokens(self):
        if self.input_tokens is None or self.output_tokens is None:
            return None
        return self.input_tokens + self.output_tokens

    def clean(self):
        super().clean()
        _validate_string_list(self.input_references, 'input_references', allow_empty=False)
        _validate_string_list(self.citations, 'citations')
        _validate_string_list(self.redacted_fields, 'redacted_fields')
        trace_payloads = (
            self.input_references, self.citations, self.input_snapshot, self.structured_output,
            self.tool_calls, self.error_message, self.human_feedback,
        )
        violated = next((p for p in trace_payloads if _trace_contains_private_data(p)), None)
        if violated is not None:
            raise ValidationError({
                'privacy_status': (
                    f'AgentRun trace contains raw PII or prompt/body content '
                    f'(path: {_trace_contains_private_data(violated)})'
                ),
            })
        if self.redacted_fields and self.privacy_status != 'redacted':
            raise ValidationError({'privacy_status': 'Runs with redacted_fields must be marked redacted.'})
        if self.privacy_status == 'blocked' and self.status not in {'blocked', 'failed'}:
            raise ValidationError({'status': 'Privacy-blocked traces cannot be successful.'})
        if self.started_at and self.finished_at and self.finished_at < self.started_at:
            raise ValidationError({'finished_at': 'Finish time cannot precede start time.'})
        if self.status in {'succeeded', 'failed', 'fallback', 'blocked'} and not self.finished_at:
            raise ValidationError({'finished_at': 'Terminal AgentRun states require finished_at.'})
        if self.human_feedback and (not self.feedback_by or not self.feedback_at):
            raise ValidationError({'human_feedback': 'Human feedback requires feedback_by and feedback_at.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.run_id}:{self.task_type}:{self.status}'


class AgentWorkflowRun(models.Model):
    """AIX-01: recoverable, idempotent orchestration around business records.

    The workflow stores references and protocol metadata only. Raw prompts,
    contact details and chain-of-thought must never be persisted here.
    """

    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('awaiting_human_review', 'Awaiting human review'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    CHECKPOINT_CHOICES = [
        ('queued', 'Queued'),
        ('evidence_retrieved', 'Evidence retrieved'),
        ('match_generated', 'Match generated'),
        ('match_verified', 'Machine verified'),
        ('proposal_generated', 'Proposal generated'),
        ('proposal_verified', 'Proposal verified'),
        ('human_review', 'Human review'),
        ('completed', 'Completed'),
    ]

    run_id = models.UUIDField(unique=True, editable=False, verbose_name='工作流运行 ID')
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='agent_workflows', verbose_name='工作区',
    )
    event = models.ForeignKey(
        UniversityEvent, on_delete=models.CASCADE, related_name='agent_workflows', verbose_name='活动',
    )
    match = models.ForeignKey(
        CollaborationMatch, on_delete=models.SET_NULL, related_name='agent_workflows',
        null=True, blank=True, verbose_name='匹配',
    )
    proposal = models.ForeignKey(
        Proposal, on_delete=models.SET_NULL, related_name='agent_workflows',
        null=True, blank=True, verbose_name='提案',
    )
    idempotency_key = models.CharField(max_length=180, verbose_name='幂等键')
    request_hash = models.CharField(max_length=64, verbose_name='请求指纹')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='queued', verbose_name='状态')
    checkpoint = models.CharField(
        max_length=32, choices=CHECKPOINT_CHOICES, default='queued', verbose_name='最近检查点',
    )
    checkpoints = models.JSONField(default=list, blank=True, verbose_name='检查点审计')
    source_ids = models.JSONField(default=list, blank=True, verbose_name='来源引用')
    schema_version = models.CharField(max_length=80, verbose_name='Schema 版本')
    prompt_version = models.CharField(max_length=80, verbose_name='Prompt 版本')
    provider_name = models.CharField(max_length=80, verbose_name='Provider')
    verifier = models.JSONField(default=dict, blank=True, verbose_name='独立验证结果')
    external_side_effect = models.BooleanField(default=False, verbose_name='是否产生外部副作用')
    error_code = models.CharField(max_length=120, blank=True, default='', verbose_name='错误码')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='开始时间')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'idempotency_key'], name='unique_workspace_agent_workflow_key',
            ),
        ]

    def clean(self):
        super().clean()
        _validate_string_list(self.source_ids, 'source_ids')
        if self.event_id and self.workspace_id and self.event.workspace_id != self.workspace_id:
            raise ValidationError({'workspace': 'Workflow workspace must equal the event workspace.'})
        if self.match_id and (self.match.workspace_id != self.workspace_id or self.match.event_id != self.event_id):
            raise ValidationError({'match': 'Workflow match must belong to the same workspace and event.'})
        if self.proposal_id and self.proposal.match_id != self.match_id:
            raise ValidationError({'proposal': 'Workflow proposal must belong to the workflow match.'})
        if self.external_side_effect:
            raise ValidationError({'external_side_effect': 'AI workflow orchestration cannot perform external side effects.'})
        if not isinstance(self.checkpoints, list):
            raise ValidationError({'checkpoints': 'Checkpoints must be an ordered list.'})
        if self.status == 'completed' and (self.checkpoint != 'completed' or not self.finished_at):
            raise ValidationError({'status': 'Completed workflows require the completed checkpoint and finish time.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.run_id}:{self.checkpoint}:{self.status}'


class EvidenceSource(models.Model):
    """AIX-07/13: immutable, workspace-scoped provenance for graph claims."""

    SOURCE_TYPE_CHOICES = [
        ('event', 'Event record'),
        ('capability', 'Approved capability'),
        ('official_web', 'Official web page'),
        ('public_web', 'Public web page'),
    ]
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='evidence_sources', verbose_name='工作区',
    )
    source_id = models.CharField(max_length=180, verbose_name='稳定来源 ID')
    source_type = models.CharField(max_length=24, choices=SOURCE_TYPE_CHOICES, verbose_name='来源类型')
    title = models.CharField(max_length=500, verbose_name='来源标题')
    url = models.URLField(max_length=1000, blank=True, default='', verbose_name='公开来源 URL')
    domain = models.CharField(max_length=255, blank=True, default='', verbose_name='来源域名')
    is_official = models.BooleanField(default=False, verbose_name='是否官方来源')
    authority_score = models.PositiveSmallIntegerField(default=0, validators=SCORE_VALIDATORS)
    content_hash = models.CharField(max_length=64, verbose_name='正文指纹')
    retrieved_at = models.DateTimeField(default=timezone.now, verbose_name='核验时间')
    metadata = models.JSONField(default=dict, blank=True, verbose_name='安全来源元数据')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-authority_score', '-retrieved_at']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'source_id'], name='unique_workspace_evidence_source_id',
            ),
        ]

    def clean(self):
        super().clean()
        if not re.fullmatch(r'[0-9a-f]{64}', self.content_hash or ''):
            raise ValidationError({'content_hash': 'Evidence source requires a SHA-256 content hash.'})
        if self.source_type in {'official_web', 'public_web'} and not self.url:
            raise ValidationError({'url': 'Web evidence requires a public URL.'})
        pii_path = _trace_contains_private_data(self.metadata)
        if pii_path:
            raise ValidationError({'metadata': f'Evidence source metadata cannot contain PII or raw prompts (path: {pii_path}).'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class EvidenceClaim(models.Model):
    """AIX-07: one queryable claim anchored to an exact source quote."""

    STATUS_CHOICES = [
        ('verified', 'Verified'), ('conflict', 'Conflict'), ('expired', 'Expired'), ('unknown', 'Unknown'),
    ]
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='evidence_claims', verbose_name='工作区',
    )
    claim_id = models.CharField(max_length=180, verbose_name='稳定 Claim ID')
    subject_type = models.CharField(max_length=40, verbose_name='主体类型')
    subject_id = models.CharField(max_length=180, verbose_name='主体 ID')
    predicate = models.CharField(max_length=120, verbose_name='关系/字段')
    value = models.JSONField(verbose_name='结构化事实值')
    source = models.ForeignKey(
        EvidenceSource, on_delete=models.PROTECT, related_name='claims', verbose_name='原始来源',
    )
    quote = models.TextField(verbose_name='原文片段')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='verified')
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    checked_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['subject_type', 'subject_id', 'predicate']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'claim_id'], name='unique_workspace_evidence_claim_id',
            ),
        ]
        indexes = [
            models.Index(fields=['workspace', 'subject_type', 'subject_id'], name='evidence_subject_idx'),
            models.Index(fields=['workspace', 'status'], name='evidence_status_idx'),
        ]

    def clean(self):
        super().clean()
        if self.source_id and self.workspace_id and self.source.workspace_id != self.workspace_id:
            raise ValidationError({'source': 'Claim and evidence source must share a workspace.'})
        if not isinstance(self.quote, str) or not self.quote.strip():
            raise ValidationError({'quote': 'Every claim requires a non-empty original quote.'})
        if len(self.quote) > 2000:
            raise ValidationError({'quote': 'Evidence quotes are limited to 2,000 characters.'})
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValidationError({'valid_until': 'Claim validity cannot end before it begins.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class EvidenceRelation(models.Model):
    """AIX-07: adjacency edge whose assertion is itself backed by a claim."""

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='evidence_relations', verbose_name='工作区',
    )
    from_kind = models.CharField(max_length=40)
    from_id = models.CharField(max_length=180)
    relation_type = models.CharField(max_length=80)
    to_kind = models.CharField(max_length=40)
    to_id = models.CharField(max_length=180)
    via_claim = models.ForeignKey(
        EvidenceClaim, on_delete=models.PROTECT, related_name='relations', verbose_name='关系证据',
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'from_kind', 'from_id', 'relation_type', 'to_kind', 'to_id', 'via_claim'],
                name='unique_evidence_relation_edge',
            ),
        ]
        indexes = [
            models.Index(fields=['workspace', 'from_kind', 'from_id'], name='evidence_from_idx'),
            models.Index(fields=['workspace', 'to_kind', 'to_id'], name='evidence_to_idx'),
        ]

    def clean(self):
        super().clean()
        if self.via_claim_id and self.workspace_id and self.via_claim.workspace_id != self.workspace_id:
            raise ValidationError({'via_claim': 'Relation evidence must belong to the same workspace.'})
        pii_path = _trace_contains_private_data(self.metadata)
        if pii_path:
            raise ValidationError({'metadata': f'Relation metadata cannot contain PII or prompts (path: {pii_path}).'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Opportunity(models.Model):
    """AIX-08: versioned opportunity hypothesis composed from graph claims."""

    STATUS_CHOICES = [('draft', 'Draft'), ('reviewed', 'Reviewed'), ('rejected', 'Rejected')]
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='opportunities')
    event = models.ForeignKey(UniversityEvent, on_delete=models.CASCADE, related_name='opportunities')
    opportunity_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    schema_version = models.CharField(max_length=80, default='opportunity-v1')
    hypothesis = models.TextField()
    target_audiences = models.JSONField(default=list)
    supporting_claims = models.ManyToManyField(EvidenceClaim, related_name='supported_opportunities')
    counter_claims = models.ManyToManyField(EvidenceClaim, related_name='challenged_opportunities')
    missing_facts = models.JSONField(default=list)
    success_metrics = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    model_version = models.CharField(max_length=120, default='deterministic-opportunity-v1')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        super().clean()
        if self.event_id and self.workspace_id and self.event.workspace_id != self.workspace_id:
            raise ValidationError({'workspace': 'Opportunity and event must share a workspace.'})
        _validate_string_list(self.target_audiences, 'target_audiences', allow_empty=False)
        _validate_string_list(self.missing_facts, 'missing_facts', allow_empty=False)
        if not isinstance(self.success_metrics, list) or not self.success_metrics:
            raise ValidationError({'success_metrics': 'At least one verifiable KPI is required.'})
        for metric in self.success_metrics:
            if not isinstance(metric, dict) or not all(metric.get(key) for key in ('name', 'target', 'measurement')):
                raise ValidationError({'success_metrics': 'Each KPI requires name, target, and measurement.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class WebResearchDocument(models.Model):
    """AIX-13: bounded official-page extraction receipt; full raw HTML is not retained."""

    STATUS_CHOICES = [('verified', 'Verified'), ('rejected', 'Rejected')]
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='research_documents')
    source = models.OneToOneField(
        EvidenceSource, on_delete=models.PROTECT, related_name='research_document', null=True, blank=True,
    )
    requested_url = models.URLField(max_length=1000)
    final_url = models.URLField(max_length=1000, blank=True, default='')
    domain = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    official_score = models.PositiveSmallIntegerField(default=0, validators=SCORE_VALIDATORS)
    content_type = models.CharField(max_length=120, blank=True, default='')
    content_bytes = models.PositiveIntegerField(default=0)
    body_sha256 = models.CharField(max_length=64, blank=True, default='')
    title = models.CharField(max_length=500, blank=True, default='')
    excerpt = models.TextField(blank=True, default='')
    injection_flags = models.JSONField(default=list, blank=True)
    rejection_reason = models.CharField(max_length=160, blank=True, default='')
    fetched_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-official_score', '-fetched_at']

    def clean(self):
        super().clean()
        if self.source_id and self.workspace_id and self.source.workspace_id != self.workspace_id:
            raise ValidationError({'source': 'Research document and source must share a workspace.'})
        if self.status == 'verified' and (not self.source_id or not self.final_url or not self.excerpt):
            raise ValidationError({'status': 'Verified research requires a source, final URL, and excerpt.'})
        if self.status == 'rejected' and not self.rejection_reason:
            raise ValidationError({'rejection_reason': 'Rejected research requires a reason code.'})
        _validate_string_list(self.injection_flags, 'injection_flags')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class DailyAgentBudget(models.Model):
    """OBS-4: workspace daily provider budget with deterministic fallback state."""

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='agent_budgets')
    date = models.DateField(verbose_name='预算日期')
    limit_microusd = models.PositiveBigIntegerField(default=0, verbose_name='预算上限 (micro USD)')
    spent_microusd = models.PositiveBigIntegerField(default=0, verbose_name='已用成本 (micro USD)')
    request_limit = models.PositiveIntegerField(default=0, verbose_name='请求上限，0 表示不限')
    request_count = models.PositiveIntegerField(default=0, verbose_name='已用请求数')
    fallback_only = models.BooleanField(default=False, verbose_name='仅允许确定性降级')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'date'], name='unique_workspace_agent_budget_date'),
        ]

    @property
    def exceeded(self):
        return bool(
            self.fallback_only
            or (self.limit_microusd and self.spent_microusd >= self.limit_microusd)
            or (self.request_limit and self.request_count >= self.request_limit)
        )


class AgentAlert(models.Model):
    """OBS-5: deduplicated, auditable operational alert without raw content."""

    SEVERITY_CHOICES = [('info', 'Info'), ('warning', 'Warning'), ('critical', 'Critical')]
    STATUS_CHOICES = [('open', 'Open'), ('acknowledged', 'Acknowledged'), ('resolved', 'Resolved')]
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='agent_alerts')
    alert_key = models.CharField(max_length=180, verbose_name='告警幂等键')
    alert_type = models.CharField(max_length=80, verbose_name='告警类型')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='warning')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    connector = models.ForeignKey(
        SourceConnector, on_delete=models.SET_NULL, null=True, blank=True, related_name='agent_alerts',
    )
    summary = models.CharField(max_length=300, verbose_name='脱敏摘要')
    evidence = models.JSONField(default=dict, blank=True, verbose_name='聚合指标证据')
    occurrence_count = models.PositiveIntegerField(default=1)
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-last_seen_at']
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'alert_key'], name='unique_workspace_agent_alert_key'),
        ]

    def clean(self):
        super().clean()
        ev_path = _trace_contains_private_data(self.evidence)
        sum_path = _trace_contains_private_data(self.summary)
        if ev_path or sum_path:
            raise ValidationError({
                'evidence': f'Alerts may contain aggregate metrics only, never PII or raw content (path: {ev_path or sum_path}).',
            })
        if self.status == 'resolved' and not self.resolved_at:
            raise ValidationError({'resolved_at': 'Resolved alerts require resolved_at.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class PipelineRun(models.Model):
    """自动化流水线运行记录 — 4 步骤：采集 → 推文 → 邮件 → 审批"""
    STEP_CHOICES = [
        ('collect_events', '活动采集'),
        ('fetch_tweets', '推文回顾'),
        ('generate_emails', 'AI 邮件生成'),
        ('auto_approve', '自动审批发送'),
    ]
    STATUS_CHOICES = [
        ('idle', '待运行'),
        ('running', '运行中'),
        ('stopped', '已停止'),
        ('succeeded', '成功'),
        ('failed', '失败'),
    ]

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='pipeline_runs', default=1, verbose_name='工作区',
    )
    step = models.CharField(max_length=30, choices=STEP_CHOICES, verbose_name='步骤')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='idle', verbose_name='状态')
    stop_requested = models.BooleanField(default=False, verbose_name='请求停止')
    collected = models.PositiveIntegerField(default=0, verbose_name='采集/扫描数')
    added = models.PositiveIntegerField(default=0, verbose_name='新增数')
    skipped = models.PositiveIntegerField(default=0, verbose_name='跳过/重复数')
    failed = models.PositiveIntegerField(default=0, verbose_name='失败数')
    duration_ms = models.PositiveIntegerField(default=0, verbose_name='耗时(ms)')
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='开始时间')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='结束时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '流水线运行'
        verbose_name_plural = '流水线运行'

    def __str__(self):
        return f'[{self.get_step_display()}] {self.get_status_display()}'


class PipelineConfig(models.Model):
    """每个流水线步骤的可配置项：定时 + 开关 + 采集上限"""
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='pipeline_configs', default=1, verbose_name='工作区',
    )
    step = models.CharField(max_length=30, choices=PipelineRun.STEP_CHOICES, verbose_name='步骤')
    enabled = models.BooleanField(default=False, verbose_name='启用自动运行')
    schedule_time = models.CharField(max_length=5, default='08:00', verbose_name='定时时间 (HH:MM)')
    max_count = models.PositiveIntegerField(default=10, verbose_name='采集/处理上限')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['workspace', 'step'], name='unique_workspace_pipeline_step'),
        ]
        verbose_name = '流水线配置'
        verbose_name_plural = '流水线配置'

    def __str__(self):
        return f'{self.get_step_display()} — {"启用" if self.enabled else "关闭"} @ {self.schedule_time} (max:{self.max_count})'
