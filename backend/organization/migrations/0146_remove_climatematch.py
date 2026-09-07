"""Remove the ClimateMatch feature.

This migration is ONE-WAY. The reverse operations are no-ops so that
`migrate organization 0145` does not fail, but the dropped tables and their
data do NOT come back. The archive produced before deploy (anonymised
aggregate CSV + full `dumpdata` JSON) is the only recovery path.
"""

from django.db import migrations


def delete_climate_match_bookkeeping(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    ContentType.objects.filter(app_label="climate_match").delete()
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DELETE FROM django_migrations WHERE app = 'climate_match'")


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0145_delete_organizationfieldtagging"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="organizationtags",
            name="show_in_climatematch",
        ),
        migrations.RunSQL(
            sql="""
                DROP TABLE IF EXISTS
                    climate_match_userquestionanswer_answers,
                    climate_match_answer_answer_metadata,
                    climate_match_userquestionanswer,
                    climate_match_answertranslation,
                    climate_match_questiontranslation,
                    climate_match_answermetadata,
                    climate_match_answer,
                    climate_match_question
                CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(
            delete_climate_match_bookkeeping,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
