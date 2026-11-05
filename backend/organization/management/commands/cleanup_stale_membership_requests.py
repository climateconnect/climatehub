import logging

from django.core.management.base import BaseCommand
from django.db.models import Count, Exists, OuterRef

from organization.models.members import MembershipRequests, ProjectMember
from organization.utility import MembershipTarget, RequestStatus

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Deletes APPROVED project membership requests whose user has no active "
        "ProjectMember row, so former members can request to join again."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report what would be deleted.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        duplicates = (
            ProjectMember.objects.values("user_id", "project_id")
            .annotate(n=Count("id"))
            .filter(n__gt=1)
        )
        for dup in duplicates:
            logger.warning(
                f"Duplicate ProjectMember rows for user {dup['user_id']}, "
                f"project {dup['project_id']} need manual review"
            )

        has_active_member = ProjectMember.objects.filter(
            user=OuterRef("user"), project=OuterRef("target_project"), is_active=True
        )
        stale = MembershipRequests.objects.filter(
            target_membership_type=MembershipTarget.PROJECT.value,
            request_status=RequestStatus.APPROVED.value,
            target_project__isnull=False,
        ).filter(~Exists(has_active_member))

        for req in stale:
            self.stdout.write(
                f"{'Would delete' if dry_run else 'Deleting'}: user_id={req.user_id} "
                f"project_id={req.target_project_id} request_id={req.id}"
            )
            logger.info(
                f"Stale membership request user_id={req.user_id} "
                f"project_id={req.target_project_id} request_id={req.id}"
            )
        count = stale.count()
        if not dry_run:
            stale.delete()
        self.stdout.write(
            f"{count} stale request(s) {'found' if dry_run else 'deleted'}."
        )
