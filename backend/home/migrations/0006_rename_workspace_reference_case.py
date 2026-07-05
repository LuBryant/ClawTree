# Generated for the ClawTree reference-case naming update on 2026-07-05.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('home', '0005_workspace_platform'),
    ]

    operations = [
        migrations.RenameField(
            model_name='workspace',
            old_name='is_genesis',
            new_name='is_reference_case',
        ),
        migrations.AlterField(
            model_name='workspace',
            name='is_reference_case',
            field=models.BooleanField(default=False, verbose_name='是否参考演示案例'),
        ),
    ]
