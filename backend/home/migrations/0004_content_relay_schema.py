# Generated for DATA-1~5 on 2026-07-03

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0003_tweetreview'),
    ]

    operations = [
        migrations.CreateModel(
            name='SourceConnector',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=160, verbose_name='连接器名称')),
                ('platform', models.CharField(choices=[('x', 'X / Twitter'), ('wechat', 'WeChat Official Account'), ('website', 'Website / RSS'), ('campus', 'Campus Source'), ('manual', 'Manual Import')], max_length=20, verbose_name='平台')),
                ('account_or_site', models.CharField(blank=True, default='', max_length=300, verbose_name='账号/站点')),
                ('auth_mode', models.CharField(choices=[('none', 'No auth / public'), ('api_key_ref', 'Server secret reference'), ('oauth_ref', 'OAuth secret reference'), ('manual_upload', 'Manual upload')], default='none', max_length=30, verbose_name='授权方式')),
                ('secret_ref', models.CharField(blank=True, default='', max_length=200, verbose_name='服务端密钥引用')),
                ('frequency', models.CharField(default='daily', max_length=80, verbose_name='抓取频率')),
                ('cursor', models.CharField(blank=True, default='', max_length=500, verbose_name='增量游标')),
                ('daily_budget_cents', models.PositiveIntegerField(default=0, verbose_name='单日预算（分）')),
                ('status', models.CharField(choices=[('active', 'Active'), ('paused', 'Paused'), ('blocked', 'Blocked')], default='paused', max_length=20, verbose_name='状态')),
                ('owner', models.CharField(max_length=120, verbose_name='负责人')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={
                'verbose_name': '来源连接器',
                'verbose_name_plural': '来源连接器',
                'ordering': ['platform', 'name'],
            },
        ),
        migrations.CreateModel(
            name='IngestionRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('scheduled', 'Scheduled'), ('running', 'Running'), ('succeeded', 'Succeeded'), ('failed', 'Failed'), ('retrying', 'Retrying')], default='scheduled', max_length=20, verbose_name='状态')),
                ('scheduled_at', models.DateTimeField(blank=True, null=True, verbose_name='计划时间')),
                ('started_at', models.DateTimeField(blank=True, null=True, verbose_name='开始时间')),
                ('finished_at', models.DateTimeField(blank=True, null=True, verbose_name='结束时间')),
                ('cursor_before', models.CharField(blank=True, default='', max_length=500, verbose_name='运行前游标')),
                ('cursor_after', models.CharField(blank=True, default='', max_length=500, verbose_name='运行后游标')),
                ('collected_count', models.PositiveIntegerField(default=0, verbose_name='采集数量')),
                ('new_count', models.PositiveIntegerField(default=0, verbose_name='新增数量')),
                ('duplicate_count', models.PositiveIntegerField(default=0, verbose_name='重复数量')),
                ('failed_count', models.PositiveIntegerField(default=0, verbose_name='失败数量')),
                ('duration_ms', models.PositiveIntegerField(default=0, verbose_name='耗时毫秒')),
                ('model_cost_cents', models.PositiveIntegerField(default=0, verbose_name='模型成本（分）')),
                ('retry_count', models.PositiveIntegerField(default=0, verbose_name='重试次数')),
                ('error_code', models.CharField(blank=True, default='', max_length=120, verbose_name='错误码')),
                ('error_message', models.TextField(blank=True, default='', verbose_name='错误摘要')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('connector', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='runs', to='home.sourceconnector', verbose_name='来源连接器')),
            ],
            options={
                'verbose_name': '采集运行',
                'verbose_name_plural': '采集运行',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ContentItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_platform', models.CharField(choices=[('x', 'X / Twitter'), ('wechat', 'WeChat Official Account'), ('website', 'Website / RSS'), ('campus', 'Campus Source'), ('manual', 'Manual Import')], max_length=20, verbose_name='来源平台')),
                ('source_url', models.URLField(max_length=800, verbose_name='来源 URL')),
                ('external_id', models.CharField(blank=True, default='', max_length=200, verbose_name='外部 ID')),
                ('publisher', models.CharField(blank=True, default='', max_length=200, verbose_name='发布者')),
                ('published_at', models.DateTimeField(blank=True, null=True, verbose_name='发布时间')),
                ('fetched_at', models.DateTimeField(blank=True, null=True, verbose_name='抓取/核验时间')),
                ('raw_text', models.TextField(verbose_name='不可变原文')),
                ('normalized_text', models.TextField(blank=True, default='', verbose_name='规范化文本')),
                ('content_hash', models.CharField(max_length=128, unique=True, verbose_name='内容哈希')),
                ('cluster_key', models.CharField(blank=True, db_index=True, default='', max_length=128, verbose_name='聚类键')),
                ('topic_scores', models.JSONField(blank=True, default=dict, verbose_name='主题分数')),
                ('media_urls', models.JSONField(blank=True, default=list, verbose_name='媒体引用')),
                ('media_license_status', models.CharField(choices=[('unknown', 'Unknown'), ('licensed', 'Licensed'), ('link_only', 'Link only'), ('rejected', 'Rejected')], default='unknown', max_length=20, verbose_name='媒体授权状态')),
                ('source_metadata', models.JSONField(blank=True, default=dict, verbose_name='来源元数据')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('connector', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='content_items', to='home.sourceconnector', verbose_name='来源连接器')),
                ('ingestion_run', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='content_items', to='home.ingestionrun', verbose_name='采集运行')),
            ],
            options={
                'verbose_name': '内容条目',
                'verbose_name_plural': '内容条目',
                'ordering': ['-published_at', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='EditorialReview',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('collected', 'Collected'), ('classified', 'Classified'), ('needs_review', 'Needs review'), ('approved', 'Approved'), ('published', 'Published'), ('rejected', 'Rejected')], default='collected', max_length=20, verbose_name='状态')),
                ('classification', models.JSONField(blank=True, default=dict, verbose_name='分类结果')),
                ('risk_labels', models.JSONField(blank=True, default=list, verbose_name='风险标签')),
                ('suggested_title', models.CharField(blank=True, default='', max_length=500, verbose_name='建议标题')),
                ('suggested_text', models.TextField(blank=True, default='', verbose_name='建议稿')),
                ('diff_summary', models.TextField(blank=True, default='', verbose_name='变更 diff 摘要')),
                ('source_refs', models.JSONField(blank=True, default=list, verbose_name='事实引用')),
                ('model_version', models.CharField(blank=True, default='', max_length=120, verbose_name='模型/规则版本')),
                ('reviewer', models.CharField(blank=True, default='', max_length=120, verbose_name='审核人')),
                ('reviewed_at', models.DateTimeField(blank=True, null=True, verbose_name='审核时间')),
                ('published_at', models.DateTimeField(blank=True, null=True, verbose_name='发布时间')),
                ('rejection_reason', models.TextField(blank=True, default='', verbose_name='驳回原因')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('content_item', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='editorial_review', to='home.contentitem', verbose_name='内容条目')),
            ],
            options={
                'verbose_name': '编辑审核',
                'verbose_name_plural': '编辑审核',
                'ordering': ['-updated_at'],
            },
        ),
    ]
