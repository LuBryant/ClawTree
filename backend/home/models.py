from django.core.exceptions import ValidationError
from django.db import models


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
