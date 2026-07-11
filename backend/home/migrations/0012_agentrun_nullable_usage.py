from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0011_agentworkflowrun'),
    ]

    operations = [
        migrations.AlterField(
            model_name='agentrun', name='input_tokens',
            field=models.PositiveIntegerField(blank=True, default=None, null=True, verbose_name='输入 token'),
        ),
        migrations.AlterField(
            model_name='agentrun', name='output_tokens',
            field=models.PositiveIntegerField(blank=True, default=None, null=True, verbose_name='输出 token'),
        ),
        migrations.AlterField(
            model_name='agentrun', name='cached_input_tokens',
            field=models.PositiveIntegerField(blank=True, default=None, null=True, verbose_name='缓存输入 token'),
        ),
        migrations.AlterField(
            model_name='agentrun', name='cost_microusd',
            field=models.PositiveBigIntegerField(blank=True, default=None, null=True, verbose_name='成本 (micro USD)'),
        ),
    ]
