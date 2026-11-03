from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0146_remove_climatematch"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="is_draft",
            field=models.BooleanField(
                default=False,
                help_text="Whether organization is public or just a private draft",
                verbose_name="Is Draft?",
            ),
        ),
    ]
