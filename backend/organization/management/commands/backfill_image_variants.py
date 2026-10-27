"""
Management command to backfill WebP image variants for existing
``Project``, ``Organization``, and ``UserProfile`` rows.

The command is **idempotent** and **resumable**: rows that already have every
configured variant are skipped, so a re-run after an interruption only does the
work that is actually left. Pass ``--force`` to regenerate variants that already
exist (e.g. after changing the quality settings).

Because a backfill downloads, re-encodes, and re-uploads every image from
Azure Blob Storage, it pauses for ``--sleep`` seconds between batches to keep
pressure off storage and the worker.

Usage::

    pdm run python manage.py backfill_image_variants
    pdm run python manage.py backfill_image_variants --dry-run
    pdm run python manage.py backfill_image_variants --model Project --sleep 2
    pdm run python manage.py backfill_image_variants --force --batch-size 50
"""

import logging
import time

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from climateconnect_main.utility.image_variants import (
    IMAGE_VARIANT_CONFIGS,
    generate_and_store_variants,
    has_all_variants,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Backfill WebP image variants for existing Project, Organization, "
        "and UserProfile rows whose images have no variants yet. "
        "Idempotent — safe to re-run; already-complete rows are skipped."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Number of instances to process between pauses (default: 100).",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=1.0,
            help=(
                "Seconds to pause between batches, to throttle storage I/O "
                "(default: 1.0). Use 0 to disable throttling."
            ),
        )
        parser.add_argument(
            "--model",
            choices=sorted(IMAGE_VARIANT_CONFIGS.keys()),
            help="Only backfill this model (default: all three).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Stop after processing this many instances (per model).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Regenerate variants even for rows that already have them.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be processed without writing any files.",
        )

    def _models_to_backfill(self, selected):
        from climateconnect_api.models import UserProfile
        from organization.models import Organization, Project

        available = {
            "Project": Project,
            "Organization": Organization,
            "UserProfile": UserProfile,
        }

        if selected:
            if selected not in available:
                raise CommandError("Unknown model: {}".format(selected))
            return [(selected, available[selected])]

        return list(available.items())

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        sleep_seconds = options["sleep"]
        limit = options.get("limit")
        force = options["force"]
        dry_run = options["dry_run"]

        if batch_size < 1:
            raise CommandError("--batch-size must be at least 1")
        if sleep_seconds < 0:
            raise CommandError("--sleep cannot be negative")

        totals = {"processed": 0, "skipped": 0, "failed": 0}

        for model_name, model in self._models_to_backfill(options.get("model")):
            image_fields = list(IMAGE_VARIANT_CONFIGS[model_name].keys())

            # Only rows that actually have at least one image are candidates.
            filter_q = Q()
            for field in image_fields:
                filter_q |= Q(**{"{}__gt".format(field): ""})
            queryset = model.objects.filter(filter_q).order_by("pk")

            candidates = queryset.count()
            self.stdout.write(
                self.style.NOTICE(
                    "{}: {} rows with images".format(model_name, candidates)
                )
            )

            processed = skipped = failed = 0

            for instance in queryset.iterator():
                if limit is not None and processed >= limit:
                    self.stdout.write(
                        "  --limit reached, stopping after {} rows".format(processed)
                    )
                    break

                if not force and has_all_variants(instance):
                    skipped += 1
                    continue

                if dry_run:
                    processed += 1
                    continue

                try:
                    generate_and_store_variants(instance)
                    processed += 1
                except Exception as exc:
                    failed += 1
                    logger.error(
                        "Backfill failed for %s pk=%s: %s",
                        model_name,
                        instance.pk,
                        exc,
                        exc_info=True,
                    )
                    self.stderr.write(
                        "  error on {} pk={}: {}".format(model_name, instance.pk, exc)
                    )

                if processed and processed % batch_size == 0:
                    self.stdout.write(
                        "  {}/{} processed ({} skipped)".format(
                            processed, candidates, skipped
                        )
                    )
                    if sleep_seconds:
                        time.sleep(sleep_seconds)

            self.stdout.write(
                self.style.SUCCESS(
                    "  {}: {} processed, {} already complete, {} failed".format(
                        model_name, processed, skipped, failed
                    )
                )
            )

            totals["processed"] += processed
            totals["skipped"] += skipped
            totals["failed"] += failed

        summary = "{} processed, {} already complete, {} failed".format(
            totals["processed"], totals["skipped"], totals["failed"]
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\nDry run: {} would be processed, {} already complete. "
                    "No files written.".format(totals["processed"], totals["skipped"])
                )
            )
        elif totals["failed"]:
            self.stdout.write(self.style.WARNING("\nBackfill finished — " + summary))
        else:
            self.stdout.write(self.style.SUCCESS("\nBackfill complete — " + summary))
