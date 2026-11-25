from django.db import migrations


def create_toggle(apps, schema_editor):
    FeatureToggle = apps.get_model("feature_toggles", "FeatureToggle")
    FeatureToggle.objects.get_or_create(
        name="PROJECT_JOIN_REQUEST_RESPOND_CHAT",
        defaults={
            "description": (
                "Shows a Respond button on project join requests that starts "
                "a shared chat between the requester and the project admins."
            ),
            "production_is_active": False,
            "staging_is_active": True,
            "development_is_active": True,
        },
    )


def remove_toggle(apps, schema_editor):
    FeatureToggle = apps.get_model("feature_toggles", "FeatureToggle")
    FeatureToggle.objects.filter(name="PROJECT_JOIN_REQUEST_RESPOND_CHAT").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("feature_toggles", "0008_add_project_join_request_confirmation_toggle"),
    ]

    operations = [
        migrations.RunPython(create_toggle, reverse_code=remove_toggle),
    ]
