import logging
from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from organization.models import Project
from organization.models.translations import ProjectTranslation
from organization.utility.legacy_description_to_tiptap import (
    legacy_description_to_tiptap_html_v2,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Re-convert legacy plain-text descriptions to Tiptap HTML (v2), "
        "preserving line breaks / blank-line structure. Only affects "
        "projects and translations whose updated_at predates --deployed-at "
        "(i.e. not hand-edited since deployment)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--deployed-at",
            required=True,
            help=(
                "ISO datetime (e.g. 2026-07-08T12:00:00Z). Rows with "
                "updated_at >= this are skipped (hand-edited since deployment)."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Count and show a sample without saving.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Number of rows per batch (default: 500).",
        )

    def handle(self, *args, **options):
        deployed_at = self._parse_deployed_at(options["deployed_at"])
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]

        # --- Projects ---
        projects = (
            Project.objects.filter(description__isnull=False)
            .exclude(description="")
            .filter(updated_at__lt=deployed_at)
        )
        total = projects.count()

        if total == 0:
            self.stdout.write("No projects to migrate.")
        elif dry_run:
            self.stdout.write(f"DRY RUN: {total} projects would be migrated.")
            for proj in projects[:3]:
                after = legacy_description_to_tiptap_html_v2(proj.description)
                self.stdout.write(f"\n--- Project {proj.id} ({proj.url_slug}) ---")
                self.stdout.write(f"BEFORE:\n{proj.description[:200]}...")
                self.stdout.write(f"AFTER:\n{after[:500]}...")
        else:
            migrated = self._migrate(
                projects, "description", "description_html", batch_size
            )
            logger.info("Migrated %d project descriptions (v2)", migrated)
            self.stdout.write(
                self.style.SUCCESS(f"Migrated {migrated} project descriptions (v2)")
            )

        # --- Translations ---
        translations = (
            ProjectTranslation.objects.filter(description_translation__isnull=False)
            .exclude(description_translation="")
            .filter(updated_at__lt=deployed_at)
        )
        trans_total = translations.count()

        if trans_total == 0:
            self.stdout.write("No translations to migrate.")
        elif dry_run:
            self.stdout.write(f"DRY RUN: {trans_total} translations would be migrated.")
        else:
            migrated_trans = self._migrate(
                translations,
                "description_translation",
                "description_html_translation",
                batch_size,
            )
            logger.info("Migrated %d translation descriptions (v2)", migrated_trans)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Migrated {migrated_trans} translation descriptions (v2)"
                )
            )

    def _migrate(self, queryset, source_field, target_field, batch_size):
        """Re-convert in batches. updated_at is intentionally NOT written, so the
        deployment filter stays valid and we don't falsely mark rows as edited."""
        ids = list(queryset.values_list("id", flat=True))
        total = len(ids)
        migrated = 0
        model = queryset.model
        for i in range(0, total, batch_size):
            batch_ids = ids[i : i + batch_size]
            batch = list(model.objects.filter(id__in=batch_ids))
            for obj in batch:
                setattr(
                    obj,
                    target_field,
                    legacy_description_to_tiptap_html_v2(getattr(obj, source_field)),
                )
            model.objects.bulk_update(batch, [target_field], batch_size=batch_size)
            migrated += len(batch)
            self.stdout.write(f"Processed {migrated}/{total}...")
        return migrated

    @staticmethod
    def _parse_deployed_at(value: str) -> datetime:
        parsed = parse_datetime(value)
        if parsed is None:
            raise CommandError(f"Invalid --deployed-at value: {value!r}")
        if parsed.tzinfo is None:
            parsed = timezone.make_aware(parsed, dt_timezone.utc)
        return parsed
