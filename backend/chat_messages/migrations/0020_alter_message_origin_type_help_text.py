from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat_messages", "0019_message_origin_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="message",
            name="origin_type",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "Context that originated this message. "
                    "Valid values: '' (no context), 'project', 'event_registration', "
                    "'organization', 'membership_request', 'hub'. Blank means no origin context."
                ),
                max_length=32,
                verbose_name="Origin Type",
            ),
        ),
    ]
