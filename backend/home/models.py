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
