from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from climateconnect_api.models import Availability, Role
from organization.models import Project, ProjectMember
from organization.models.members import MembershipRequests
from organization.utility import MembershipTarget, RequestStatus


class TestMembershipRequestDecidedBy(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name="Admin", role_type=Role.ALL_TYPE)
        self.member_role = Role.objects.create(
            name="Member", role_type=Role.READ_ONLY_TYPE
        )
        self.creator = User.objects.create_user(username="creator", password="pw")
        self.admin = User.objects.create_user(username="admin2", password="pw")
        self.plain_member = User.objects.create_user(username="plain", password="pw")
        self.requester = User.objects.create_user(username="requester", password="pw")
        self.project = Project.objects.create(name="P", url_slug="p-decided")
        ProjectMember.objects.create(
            user=self.creator, project=self.project, role=self.admin_role
        )
        ProjectMember.objects.create(
            user=self.admin, project=self.project, role=self.admin_role
        )
        ProjectMember.objects.create(
            user=self.plain_member, project=self.project, role=self.member_role
        )
        self.availability = Availability.objects.create(name="1h", key="1h-decided")
        self.join_request = MembershipRequests.objects.create(
            user=self.requester,
            target_membership_type=MembershipTarget.PROJECT.value,
            target_project=self.project,
            availability=self.availability,
            requested_at=timezone.now(),
            request_status=RequestStatus.PENDING.value,
        )

    def _post(self, action):
        return self.client.post(
            reverse(
                "organization:request-membership-action-entity",
                kwargs={
                    "url_slug": self.project.url_slug,
                    "request_action": action,
                    "request_id": self.join_request.id,
                },
            )
        )

    def test_approve_sets_decided_by(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self._post("approve").status_code, 200)
        self.join_request.refresh_from_db()
        self.assertEqual(self.join_request.decided_by, self.admin)
        self.assertIsNotNone(self.join_request.approved_at)
        self.assertEqual(self.join_request.request_status, RequestStatus.APPROVED.value)

    def test_reject_sets_decided_by(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self._post("reject").status_code, 200)
        self.join_request.refresh_from_db()
        self.assertEqual(self.join_request.decided_by, self.admin)
        self.assertIsNotNone(self.join_request.rejected_at)
        self.assertEqual(self.join_request.request_status, RequestStatus.REJECTED.value)

    def test_second_admin_is_recorded(self):
        self.client.force_authenticate(self.admin)
        self._post("reject")
        self.join_request.refresh_from_db()
        self.assertEqual(self.join_request.decided_by, self.admin)
        self.assertNotEqual(self.join_request.decided_by, self.creator)

    def test_pending_request_has_no_decider(self):
        self.assertIsNone(self.join_request.decided_by)

    def test_deleting_admin_keeps_request(self):
        self.client.force_authenticate(self.admin)
        self._post("approve")
        self.admin.delete()
        self.join_request.refresh_from_db()
        self.assertIsNone(self.join_request.decided_by)

    def test_non_admin_cannot_decide(self):
        self.client.force_authenticate(self.plain_member)
        self.assertEqual(self._post("approve").status_code, 403)
        self.join_request.refresh_from_db()
        self.assertIsNone(self.join_request.decided_by)
