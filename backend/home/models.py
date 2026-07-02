from django.db import models


class UniversityEvent(models.Model):
    """
    高校 AI/Web3 活动

    通过 fetch_events 管理命令自动采集，source_url 作为去重键。
    """
    title = models.CharField(max_length=500, verbose_name='活动标题')
    university = models.CharField(max_length=200, verbose_name='高校名称')
    event_date = models.DateField(null=True, blank=True, verbose_name='活动日期')
    event_end_date = models.DateField(null=True, blank=True, verbose_name='结束日期')
    location = models.CharField(max_length=300, blank=True, default='', verbose_name='活动地点')
    description = models.TextField(blank=True, default='', verbose_name='活动描述')
    source_url = models.URLField(max_length=500, unique=True, verbose_name='来源链接')
    source_name = models.CharField(max_length=100, blank=True, default='', verbose_name='来源平台')
    contact_email = models.CharField(max_length=200, blank=True, default='', verbose_name='联系人邮箱')
    contact_phone = models.CharField(max_length=50, blank=True, default='', verbose_name='联系人电话')

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
        ('讲座', '讲座'),
        ('黑客松', '黑客松'),
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
    score = models.PositiveSmallIntegerField(default=0, verbose_name='匹配度评分')
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
