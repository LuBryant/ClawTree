# Generated manually for AIX-01 unified orchestration.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0010_agent_observability'),
    ]

    operations = [
        migrations.CreateModel(
            name='AgentWorkflowRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('run_id', models.UUIDField(editable=False, unique=True, verbose_name='工作流运行 ID')),
                ('idempotency_key', models.CharField(max_length=180, verbose_name='幂等键')),
                ('request_hash', models.CharField(max_length=64, verbose_name='请求指纹')),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('running', 'Running'), ('awaiting_human_review', 'Awaiting human review'), ('completed', 'Completed'), ('failed', 'Failed')], default='queued', max_length=32, verbose_name='状态')),
                ('checkpoint', models.CharField(choices=[('queued', 'Queued'), ('evidence_retrieved', 'Evidence retrieved'), ('match_generated', 'Match generated'), ('match_verified', 'Machine verified'), ('proposal_generated', 'Proposal generated'), ('proposal_verified', 'Proposal verified'), ('human_review', 'Human review'), ('completed', 'Completed')], default='queued', max_length=32, verbose_name='最近检查点')),
                ('checkpoints', models.JSONField(blank=True, default=list, verbose_name='检查点审计')),
                ('source_ids', models.JSONField(blank=True, default=list, verbose_name='来源引用')),
                ('schema_version', models.CharField(max_length=80, verbose_name='Schema 版本')),
                ('prompt_version', models.CharField(max_length=80, verbose_name='Prompt 版本')),
                ('provider_name', models.CharField(max_length=80, verbose_name='Provider')),
                ('verifier', models.JSONField(blank=True, default=dict, verbose_name='独立验证结果')),
                ('external_side_effect', models.BooleanField(default=False, verbose_name='是否产生外部副作用')),
                ('error_code', models.CharField(blank=True, default='', max_length=120, verbose_name='错误码')),
                ('started_at', models.DateTimeField(blank=True, null=True, verbose_name='开始时间')),
                ('finished_at', models.DateTimeField(blank=True, null=True, verbose_name='完成时间')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_workflows', to='home.universityevent', verbose_name='活动')),
                ('match', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='agent_workflows', to='home.collaborationmatch', verbose_name='匹配')),
                ('proposal', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='agent_workflows', to='home.proposal', verbose_name='提案')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_workflows', to='home.workspace', verbose_name='工作区')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddConstraint(
            model_name='agentworkflowrun',
            constraint=models.UniqueConstraint(fields=('workspace', 'idempotency_key'), name='unique_workspace_agent_workflow_key'),
        ),
    ]
