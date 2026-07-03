from django.core.exceptions import ValidationError
from django.db import models


class UniversityEvent(models.Model):
    """
    高校 AI/Web3 活动

    通过 OpenClaw University-Event-Collector 自动采集，source_url 作为去重键。
    数据格式对齐 openclaw skills 输出的 JSON 结构。
    """
    title = models.CharField(max_length=500, verbose_name='活动标题')
    university = models.CharField(max_length=200, verbose_name='高校名称')
    event_date = models.DateField(null=True, blank=True, verbose_name='活动日期')
    event_end_date = models.DateField(null=True, blank=True, verbose_name='结束日期')
    location = models.CharField(max_length=300, blank=True, default='', verbose_name='活动地点')
    description = models.TextField(blank=True, default='', verbose_name='活动描述')
    source_url = models.URLField(max_length=500, unique=True, verbose_name='来源链接')
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
        ('其他', '其他'),
    ]
    event_type = models.CharField(
        max_length=20, choices=EVENT_TYPE_CHOICES, default='其他',
        verbose_name='活动类型'
    )

    registration_url = models.URLField(max_length=500, blank=True, default='', verbose_name='报名链接')
    is_contacted = models.BooleanField(default=False, verbose_name='是否已联系')
    score = models.PositiveSmallIntegerField(default=0, verbose_name='置信度 (0-100)')
    raw_data = models.TextField(blank=True, default='', verbose_name='原始数据 JSON')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='收录时间')

    class Meta:
        ordering = ['-created_at']
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
    content_hash = models.CharField(max_length=128, unique=True, verbose_name='内容哈希')
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
