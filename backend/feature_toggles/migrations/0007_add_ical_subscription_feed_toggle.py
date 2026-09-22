from django.db import migrations


def create_ical_feed_toggle(apps, schema_editor):
    FeatureToggle = apps.get_model("feature_toggles", "FeatureToggle")
    FeatureToggle.objects.get_or_create(
        name="ICAL_SUBSCRIPTION_FEED_FEATURE",
        defaults={
            "description": (
                "Shows the 'Subscribe' button on hub event calendars, allowing "
                "users to subscribe to an iCal feed that auto-updates. "
                "The feed endpoint itself is always on; this toggle only gates the UI."
            ),
            "production_is_active": False,
            "staging_is_active": True,
            "development_is_active": True,
        },
    )


def remove_ical_feed_toggle(apps, schema_editor):
    FeatureToggle = apps.get_model("feature_toggles", "FeatureToggle")
    FeatureToggle.objects.filter(name="ICAL_SUBSCRIPTION_FEED_FEATURE").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("feature_toggles", "0006_add_locationiq_autocomplete_toggle"),
    ]

    operations = [
        migrations.RunPython(
            create_ical_feed_toggle,
            reverse_code=remove_ical_feed_toggle,
        ),
    ]
