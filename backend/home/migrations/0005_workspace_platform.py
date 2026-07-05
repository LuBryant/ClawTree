# Generated for the ClawTree workspace platform boundary on 2026-07-05.

import datetime
import django.db.models.deletion
from django.db import migrations, models


def seed_treefinance_workspace(apps, schema_editor):
    Workspace = apps.get_model('home', 'Workspace')
    BrandProfile = apps.get_model('home', 'BrandProfile')
    Capability = apps.get_model('home', 'Capability')

    workspace, _ = Workspace.objects.update_or_create(
        id=1,
        defaults={
            'slug': 'treefinance',
            'name': '大树财经',
            'name_en': 'TreeFinance',
            'industries': ['MEDIA', 'WEB3', 'CAMPUS'],
            'is_genesis': True,
            'is_active': True,
        },
    )
    BrandProfile.objects.update_or_create(
        workspace=workspace,
        defaults={
            'mission': '连接 AI、Web3、财经媒体与高校创新生态。',
            'mission_en': 'Connect AI, Web3, financial media, and campus innovation.',
            'outreach_signature': '大树财经高校行团队',
            'outreach_signature_en': 'TreeFinance Campus Team',
            'guardrails': ['human_approval_required', 'no_unapproved_promises', 'no_private_data_onchain'],
        },
    )
    capabilities = [
        ('cap-media', '媒体支持与活动复盘', ['tf-profile-positioning', 'tf-nuist-recap'], 'TreeFinance Content', datetime.date(2026, 9, 30), '只承诺已批准的内容资源，不保证曝光量。'),
        ('cap-space', 'X Space / 圆桌联动', ['tf-ai-data-ama'], 'TreeFinance Ops', datetime.date(2026, 8, 31), '嘉宾、时间和主题需单独人工确认。'),
        ('cap-hackathon', 'AI×Web3 黑客松与项目招募', ['tf-htx-waic'], 'TreeFinance Ecosystem', datetime.date(2026, 7, 31), '不承诺未批准奖金、投资或主办身份。'),
    ]
    for code, title, source_ids, owner, valid_until, boundary in capabilities:
        Capability.objects.update_or_create(
            workspace=workspace,
            code=code,
            defaults={
                'title': title,
                'source_ids': source_ids,
                'owner': owner,
                'valid_until': valid_until,
                'approved': True,
                'boundary': boundary,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0004_content_relay_schema'),
    ]

    operations = [
        migrations.CreateModel(
            name='Workspace',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=80, unique=True, verbose_name='工作区标识')),
                ('name', models.CharField(max_length=160, verbose_name='工作区名称')),
                ('name_en', models.CharField(blank=True, default='', max_length=160, verbose_name='英文名称')),
                ('industries', models.JSONField(blank=True, default=list, verbose_name='行业标签')),
                ('is_genesis', models.BooleanField(default=False, verbose_name='是否参考案例')),
                ('is_active', models.BooleanField(default=True, verbose_name='是否启用')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={'verbose_name': '工作区', 'verbose_name_plural': '工作区', 'ordering': ['name']},
        ),
        migrations.CreateModel(
            name='BrandProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mission', models.TextField(blank=True, default='', verbose_name='使命')),
                ('mission_en', models.TextField(blank=True, default='', verbose_name='英文使命')),
                ('outreach_signature', models.CharField(max_length=200, verbose_name='外联署名')),
                ('outreach_signature_en', models.CharField(blank=True, default='', max_length=200, verbose_name='英文外联署名')),
                ('guardrails', models.JSONField(blank=True, default=list, verbose_name='品牌与合规边界')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('workspace', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='brand_profile', to='home.workspace', verbose_name='工作区')),
            ],
            options={'verbose_name': '品牌档案', 'verbose_name_plural': '品牌档案'},
        ),
        migrations.CreateModel(
            name='Capability',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.SlugField(max_length=80, verbose_name='能力代码')),
                ('title', models.CharField(max_length=200, verbose_name='能力名称')),
                ('title_en', models.CharField(blank=True, default='', max_length=200, verbose_name='英文能力名称')),
                ('source_ids', models.JSONField(blank=True, default=list, verbose_name='来源引用')),
                ('owner', models.CharField(max_length=120, verbose_name='负责人')),
                ('valid_until', models.DateField(verbose_name='有效期至')),
                ('approved', models.BooleanField(default=False, verbose_name='已审核')),
                ('boundary', models.TextField(blank=True, default='', verbose_name='能力边界')),
                ('boundary_en', models.TextField(blank=True, default='', verbose_name='英文能力边界')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='capabilities', to='home.workspace', verbose_name='工作区')),
            ],
            options={'verbose_name': '工作区能力', 'verbose_name_plural': '工作区能力', 'ordering': ['workspace', 'code']},
        ),
        migrations.AddConstraint(
            model_name='capability',
            constraint=models.UniqueConstraint(fields=('workspace', 'code'), name='unique_workspace_capability'),
        ),
        migrations.RunPython(seed_treefinance_workspace, migrations.RunPython.noop),
        migrations.AddField(
            model_name='universityevent', name='workspace',
            field=models.ForeignKey(default=1, on_delete=django.db.models.deletion.PROTECT, related_name='university_events', to='home.workspace', verbose_name='工作区'),
        ),
        migrations.AddField(
            model_name='eventreview', name='workspace',
            field=models.ForeignKey(default=1, on_delete=django.db.models.deletion.PROTECT, related_name='event_reviews', to='home.workspace', verbose_name='工作区'),
        ),
        migrations.AddField(
            model_name='tweetreview', name='workspace',
            field=models.ForeignKey(default=1, on_delete=django.db.models.deletion.PROTECT, related_name='tweet_reviews', to='home.workspace', verbose_name='工作区'),
        ),
        migrations.AddField(
            model_name='sourceconnector', name='workspace',
            field=models.ForeignKey(default=1, on_delete=django.db.models.deletion.CASCADE, related_name='source_connectors', to='home.workspace', verbose_name='工作区'),
        ),
        migrations.AddField(
            model_name='contentitem', name='workspace',
            field=models.ForeignKey(default=1, on_delete=django.db.models.deletion.CASCADE, related_name='content_items', to='home.workspace', verbose_name='工作区'),
        ),
        migrations.AlterField(
            model_name='universityevent', name='source_url',
            field=models.URLField(max_length=500, verbose_name='来源链接'),
        ),
        migrations.AddField(
            model_name='universityevent', name='contact_ai_email',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='AI部门邮箱'),
        ),
        migrations.AddField(
            model_name='universityevent', name='contact_wechat',
            field=models.CharField(blank=True, default='', max_length=100, verbose_name='微信'),
        ),
        migrations.AddField(
            model_name='universityevent', name='contact_qq',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='QQ'),
        ),
        migrations.AlterField(
            model_name='universityevent', name='contact_email',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='官方邮箱'),
        ),
        migrations.AlterField(
            model_name='universityevent', name='contact_phone',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='联系电话'),
        ),
        migrations.AlterField(
            model_name='universityevent', name='event_type',
            field=models.CharField(choices=[('黑客松', '黑客松'), ('分享会', '分享会'), ('讲座', '讲座'), ('竞赛', '竞赛'), ('研讨会', '研讨会'), ('论坛', '论坛'), ('工作坊', '工作坊'), ('夏令营', '夏令营'), ('其他', '其他')], default='其他', max_length=20, verbose_name='活动类型'),
        ),
        migrations.AlterField(
            model_name='universityevent', name='score',
            field=models.PositiveSmallIntegerField(default=0, verbose_name='置信度 (0-100)'),
        ),
        migrations.AlterField(
            model_name='contentitem', name='content_hash',
            field=models.CharField(max_length=128, verbose_name='内容哈希'),
        ),
        migrations.AddConstraint(
            model_name='universityevent',
            constraint=models.UniqueConstraint(fields=('workspace', 'source_url'), name='unique_workspace_event_source'),
        ),
        migrations.AddConstraint(
            model_name='contentitem',
            constraint=models.UniqueConstraint(fields=('workspace', 'content_hash'), name='unique_workspace_content_hash'),
        ),
        migrations.CreateModel(
            name='PipelineRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('step', models.CharField(choices=[('collect_events', '活动采集'), ('fetch_tweets', '推文回顾'), ('generate_emails', 'AI 邮件生成'), ('auto_approve', '自动审批发送')], max_length=30, verbose_name='步骤')),
                ('status', models.CharField(choices=[('idle', '待运行'), ('running', '运行中'), ('stopped', '已停止'), ('succeeded', '成功'), ('failed', '失败')], default='idle', max_length=20, verbose_name='状态')),
                ('stop_requested', models.BooleanField(default=False, verbose_name='请求停止')),
                ('collected', models.PositiveIntegerField(default=0, verbose_name='采集/扫描数')),
                ('added', models.PositiveIntegerField(default=0, verbose_name='新增数')),
                ('skipped', models.PositiveIntegerField(default=0, verbose_name='跳过/重复数')),
                ('failed', models.PositiveIntegerField(default=0, verbose_name='失败数')),
                ('duration_ms', models.PositiveIntegerField(default=0, verbose_name='耗时(ms)')),
                ('error_message', models.TextField(blank=True, default='', verbose_name='错误信息')),
                ('started_at', models.DateTimeField(blank=True, null=True, verbose_name='开始时间')),
                ('finished_at', models.DateTimeField(blank=True, null=True, verbose_name='结束时间')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('workspace', models.ForeignKey(default=1, on_delete=django.db.models.deletion.CASCADE, related_name='pipeline_runs', to='home.workspace', verbose_name='工作区')),
            ],
            options={'verbose_name': '流水线运行', 'verbose_name_plural': '流水线运行', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='PipelineConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('step', models.CharField(choices=[('collect_events', '活动采集'), ('fetch_tweets', '推文回顾'), ('generate_emails', 'AI 邮件生成'), ('auto_approve', '自动审批发送')], max_length=30, verbose_name='步骤')),
                ('enabled', models.BooleanField(default=False, verbose_name='启用自动运行')),
                ('schedule_time', models.CharField(default='08:00', max_length=5, verbose_name='定时时间 (HH:MM)')),
                ('max_count', models.PositiveIntegerField(default=10, verbose_name='采集/处理上限')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('workspace', models.ForeignKey(default=1, on_delete=django.db.models.deletion.CASCADE, related_name='pipeline_configs', to='home.workspace', verbose_name='工作区')),
            ],
            options={'verbose_name': '流水线配置', 'verbose_name_plural': '流水线配置'},
        ),
        migrations.AddConstraint(
            model_name='pipelineconfig',
            constraint=models.UniqueConstraint(fields=('workspace', 'step'), name='unique_workspace_pipeline_step'),
        ),
        migrations.CreateModel(
            name='OutreachDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject', models.CharField(blank=True, default='', max_length=300, verbose_name='邮件主题')),
                ('email_body', models.TextField(verbose_name='邮件正文')),
                ('recipient_email', models.CharField(blank=True, default='', max_length=200, verbose_name='收件人邮箱')),
                ('status', models.CharField(choices=[('draft', '草稿'), ('awaiting_approval', '待审批'), ('approved', '已批准'), ('rejected', '已驳回')], default='draft', max_length=20, verbose_name='审批状态')),
                ('approved_by', models.CharField(blank=True, default='', max_length=100, verbose_name='审批人')),
                ('approved_at', models.DateTimeField(blank=True, null=True, verbose_name='审批时间')),
                ('proof_tx_hash', models.CharField(blank=True, default='', max_length=200, verbose_name='链上交易哈希')),
                ('proof_network', models.CharField(blank=True, default='', max_length=50, verbose_name='链上网络')),
                ('proof_explorer_url', models.URLField(blank=True, default='', max_length=500, verbose_name='浏览器链接')),
                ('proof_created_at', models.DateTimeField(blank=True, null=True, verbose_name='凭证生成时间')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('university_event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='outreach_drafts', to='home.universityevent', verbose_name='关联活动')),
                ('workspace', models.ForeignKey(default=1, on_delete=django.db.models.deletion.PROTECT, related_name='outreach_drafts', to='home.workspace', verbose_name='工作区')),
            ],
            options={'verbose_name': '外联草稿', 'verbose_name_plural': '外联草稿', 'ordering': ['-created_at']},
        ),
    ]
