from io import StringIO
from unittest import mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Availability, Language, Role, UserProfile
from climateconnect_api.models.notification import Notification, UserNotification
from organization.models import Project, ProjectMember
from organization.models.members import MembershipRequests
from organization.utility import MembershipTarget, RequestStatus
from organization.utility.requests import (
    MembershipRequestsManager,
    remove_approved_membership_request,
)


class RejoinProjectTeamBase(APITestCase):
    def setUp(self):
        self.availability = Availability.objects.create(name="1-3 h", key="1-3-h")
        self.admin_role = Role.objects.create(
            name="Administrator", role_type=Role.ALL_TYPE
        )
        self.member_role, _ = Role.objects.get_or_create(
            name="Member", defaults={"role_type": Role.READ_ONLY_TYPE}
        )
        self.project = Project.objects.create(name="Rejoin", url_slug="rejoin")
        self.admin = User.objects.create_user(username="admin", password="pw")
        self.user = User.objects.create_user(username="joiner", password="pw")
        language = Language.objects.get(language_code="en")
        for user, slug in ((self.user, "joiner"), (self.admin, "admin")):
            UserProfile.objects.create(
                user=user, url_slug=slug, name=slug, language=language
            )
        email_patcher = mock.patch(
            "organization.utility.notification.send_join_project_request_email"
        )
        email_patcher.start()
        self.addCleanup(email_patcher.stop)
        ProjectMember.objects.create(
            user=self.admin,
            project=self.project,
            role=self.admin_role,
            availability=self.availability,
        )

    def _create_request(self, status_=RequestStatus.APPROVED, user=None):
        return MembershipRequests.objects.create(
            user=user or self.user,
            target_membership_type=MembershipTarget.PROJECT.value,
            target_project=self.project,
            availability=self.availability,
            requested_at=timezone.now(),
            request_status=status_.value,
        )

    def _join_as_member(self, req=None):
        req = req or self._create_request()
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role=self.member_role,
            availability=self.availability,
        )
        return req

    def _leave(self):
        self.client.force_authenticate(self.user)
        return self.client.post(
            reverse("organization:leave-project", kwargs={"url_slug": "rejoin"})
        )

    def _request_join(self):
        self.client.force_authenticate(self.user)
        return self.client.post(
            reverse(
                "organization:request-join-entity",
                kwargs={"url_slug": "rejoin", "user_slug": "joiner"},
            ),
            {"user_availability": self.availability.id, "message": "hi"},
            format="json",
        )

    def _remove_by_admin(self):
        member = ProjectMember.objects.get(user=self.user, project=self.project)
        self.client.force_authenticate(self.admin)
        return self.client.delete(
            reverse(
                "organization:update-project-member-api",
                kwargs={"url_slug": "rejoin", "pk": member.id},
            )
        )


class TestRejoinAfterEnding(RejoinProjectTeamBase):
    def test_leave_then_rejoin(self):
        self._join_as_member()
        self.assertEqual(self._leave().status_code, status.HTTP_200_OK)
        self.assertFalse(MembershipRequests.objects.exists())
        res = self._request_join()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            MembershipRequests.objects.get().request_status, RequestStatus.PENDING.value
        )

    def test_admin_removal_then_rejoin(self):
        self._join_as_member()
        self.assertLess(self._remove_by_admin().status_code, 300)
        self.assertFalse(MembershipRequests.objects.exists())
        self.assertEqual(self._request_join().status_code, status.HTTP_200_OK)

    def test_rejected_request_still_blocks(self):
        self._create_request(RequestStatus.REJECTED)
        self.assertEqual(self._request_join().status_code, status.HTTP_400_BAD_REQUEST)

    def test_pending_request_still_blocks(self):
        self._create_request(RequestStatus.PENDING)
        self.assertEqual(self._request_join().status_code, status.HTTP_400_BAD_REQUEST)

    def test_integrity_error_returns_400(self):
        with mock.patch.object(
            MembershipRequestsManager,
            "create_membership_request",
            side_effect=IntegrityError,
        ):
            res = self._request_join()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_leave_keeps_rejected_request(self):
        self._join_as_member(self._create_request(RequestStatus.REJECTED))
        self._leave()
        self.assertEqual(MembershipRequests.objects.count(), 1)

    def test_cleanup_noop_without_request(self):
        self.assertEqual(remove_approved_membership_request(self.user, self.project), 0)

    def test_notifications_removed_with_request(self):
        req = self._join_as_member()
        notification = Notification.objects.create(
            notification_type=Notification.JOIN_PROJECT_REQUEST,
            membership_request=req,
        )
        UserNotification.objects.create(user=self.admin, notification=notification)
        self._leave()
        self.assertFalse(Notification.objects.filter(id=notification.id).exists())
        self.assertFalse(UserNotification.objects.exists())

    def test_leave_rolls_back_if_cleanup_fails(self):
        self._join_as_member()
        with mock.patch(
            "organization.views.project_views.remove_approved_membership_request",
            side_effect=Exception("boom"),
        ):
            res = self._leave()
        self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertTrue(
            ProjectMember.objects.get(user=self.user, project=self.project).is_active
        )

    def test_admin_removal_rolls_back_if_cleanup_fails(self):
        self._join_as_member()
        with mock.patch(
            "organization.views.project_views.remove_approved_membership_request",
            side_effect=Exception("boom"),
        ):
            # the view has no exception handler, so the test client re-raises
            with self.assertRaisesMessage(Exception, "boom"):
                self._remove_by_admin()
        self.assertTrue(
            ProjectMember.objects.filter(user=self.user, project=self.project).exists()
        )
        self.assertTrue(MembershipRequests.objects.filter(user=self.user).exists())


class TestReactivationOnApproval(RejoinProjectTeamBase):
    def test_approve_reactivates_inactive_member_as_member(self):
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role=self.admin_role,
            availability=None,
            is_active=False,
        )
        req = self._create_request(RequestStatus.PENDING)
        manager = MembershipRequestsManager(
            membership_request_id=req.id,
            project=self.project,
            membership_target=MembershipTarget.PROJECT,
        )
        self.assertFalse(manager.validation_failed)
        manager.approve_request(decided_by=self.admin)
        members = ProjectMember.objects.filter(user=self.user, project=self.project)
        self.assertEqual(members.count(), 1)
        member = members.get()
        self.assertTrue(member.is_active)
        self.assertEqual(member.role, self.member_role)
        self.assertIsNone(member.role_in_project)
        self.assertEqual(member.availability, self.availability)

    def test_active_member_still_fails_validation(self):
        req = self._join_as_member(self._create_request(RequestStatus.PENDING))
        manager = MembershipRequestsManager(
            membership_request_id=req.id,
            project=self.project,
            membership_target=MembershipTarget.PROJECT,
        )
        self.assertTrue(manager.validation_failed)


class TestCleanupCommand(RejoinProjectTeamBase):
    def _run(self, *args):
        call_command("cleanup_stale_membership_requests", *args, stdout=StringIO())

    def test_dry_run_and_apply(self):
        stale = self._create_request()  # approved, no member
        other = User.objects.create_user(username="other", password="pw")
        kept = self._create_request(user=other)
        ProjectMember.objects.create(
            user=other, project=self.project, role=self.member_role
        )
        rejected_user = User.objects.create_user(username="rej", password="pw")
        rejected = self._create_request(RequestStatus.REJECTED, user=rejected_user)

        self._run("--dry-run")
        self.assertEqual(MembershipRequests.objects.count(), 3)

        self._run()
        remaining = set(MembershipRequests.objects.values_list("id", flat=True))
        self.assertEqual(remaining, {kept.id, rejected.id})
        self.assertNotIn(stale.id, remaining)

        self._run()  # idempotent
        self.assertEqual(MembershipRequests.objects.count(), 2)
