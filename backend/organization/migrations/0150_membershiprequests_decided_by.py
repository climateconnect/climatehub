import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0149_event_registration_seats"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="membershiprequests",
            name="decided_by",
            field=models.ForeignKey(
                blank=True,
                default=None,
                help_text="The admin who approved or rejected the request (null while pending)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="decided_membership_requests",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Decided by",
            ),
        ),
    ]
