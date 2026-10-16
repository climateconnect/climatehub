from django.db import migrations


def create_toggle(apps, schema_editor):
    FeatureToggle = apps.get_model("feature_toggles", "FeatureToggle")
    FeatureToggle.objects.get_or_create(
        name="PROJECT_JOIN_REQUEST_CONFIRMATION",
        defaults={
            "description": (
                "Shows a confirmation dialog with an optional message when "
                "requesting to join a project, and validates the message "
                "(plain text, max 500 characters) in the backend."
            ),
            "production_is_active": False,
            "staging_is_active": True,
            "development_is_active": True,
        },
    )


def remove_toggle(apps, schema_editor):
    FeatureToggle = apps.get_model("feature_toggles", "FeatureToggle")
    FeatureToggle.objects.filter(name="PROJECT_JOIN_REQUEST_CONFIRMATION").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("feature_toggles", "0007_add_ical_subscription_feed_toggle"),
    ]

    operations = [
        migrations.RunPython(create_toggle, reverse_code=remove_toggle),
    ]
