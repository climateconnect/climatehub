from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Tag autocomplete request tracking with the upstream provider.

    Builds on 0020_refactor_nominatim_tracking (which moved
    NominatimRequestLog to one row per request + Celery aggregation): this
    migration only adds the `provider` column to both tracking models and
    widens NominatimPeriodStats' uniqueness/index to include it, so
    LocationIQ and Nominatim usage can be counted separately.

    Existing rows default to "nominatim", which is what they were.
    """

    dependencies = [
        ("location", "0020_refactor_nominatim_tracking"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="nominatimperiodstats",
            name="location_no_period__0e6c96_idx",
        ),
        migrations.AlterUniqueTogether(
            name="nominatimperiodstats",
            unique_together=set(),
        ),
        migrations.AddField(
            model_name="nominatimperiodstats",
            name="provider",
            field=models.CharField(
                choices=[("nominatim", "Nominatim"), ("locationiq", "LocationIQ")],
                default="nominatim",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="nominatimrequestlog",
            name="provider",
            field=models.CharField(
                choices=[("nominatim", "Nominatim"), ("locationiq", "LocationIQ")],
                default="nominatim",
                max_length=20,
            ),
        ),
        migrations.AlterUniqueTogether(
            name="nominatimperiodstats",
            unique_together={("period_type", "period_key", "provider")},
        ),
        migrations.AddIndex(
            model_name="nominatimperiodstats",
            index=models.Index(
                fields=["period_type", "period_key", "provider"],
                name="location_no_period__5a9ac2_idx",
            ),
        ),
    ]
