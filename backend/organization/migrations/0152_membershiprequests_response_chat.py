import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat_messages", "0019_message_origin_fields"),
        ("organization", "0151_organization_image_variants_project_image_variants"),
    ]

    operations = [
        migrations.AddField(
            model_name="membershiprequests",
            name="response_chat",
            field=models.ForeignKey(
                blank=True,
                default=None,
                help_text="Group chat between the requester and the admins started in response to this request (null until an admin responds)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="membership_requests",
                to="chat_messages.messageparticipants",
                verbose_name="Response chat",
            ),
        ),
    ]
