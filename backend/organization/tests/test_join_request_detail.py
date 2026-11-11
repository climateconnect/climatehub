from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from climateconnect_api.models import Availability, Role, UserProfile
from organization.models import Organization, Project, ProjectMember
from organization.models.members import MembershipRequests
from organization.utility import MembershipTarget, RequestStatus


class TestJoinRequestDetail(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name="Admin", role_type=Role.ALL_TYPE)
        self.member_role = Role.objects.create(
            name="Member", role_type=Role.READ_ONLY_TYPE
        )
        self.admin = self._user("jr_admin")
        self.member = self._user("jr_member")
        self.requester = self._user("jr_requester")
        self.other = self._user("jr_other")
        self.project = Project.objects.create(name="P", url_slug="p-jr")
        self.other_project = Project.objects.create(name="Q", url_slug="q-jr")
        ProjectMember.objects.create(
            user=self.admin, project=self.project, role=self.admin_role
        )
        ProjectMember.objects.create(
            user=self.member, project=self.project, role=self.member_role
        )
        self.availability = Availability.objects.create(name="1h", key="1h-jr")
        self.join_request = self._request(self.requester, message="Hi there")

    def _user(self, name):
        user = User.objects.create_user(
            username=name, password="pw", first_name=name, last_name="x"
        )
        UserProfile.objects.create(user=user, url_slug=name, name=name)
        return user

    def _request(self, user, project=None, **kwargs):
        return MembershipRequests.objects.create(
            user=user,
            target_membership_type=MembershipTarget.PROJECT.value,
            target_project=project or self.project,
            availability=self.availability,
            requested_at=timezone.now(),
            request_status=RequestStatus.PENDING.value,
            **kwargs,
        )

    def _url(self, request_id=None, slug=None):
        return reverse(
            "organization:join-request-detail",
            kwargs={
                "url_slug": slug or self.project.url_slug,
                "request_id": request_id or self.join_request.id,
            },
        )

    def test_admin_gets_full_payload(self):
        self.join_request.request_status = RequestStatus.APPROVED.value
        self.join_request.approved_at = timezone.now()
        self.join_request.decided_by = self.admin
        self.join_request.save()
        self.client.force_authenticate(self.admin)
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["request_status"], "approved")
        self.assertEqual(res.data["message"], "Hi there")
        self.assertIsNotNone(res.data["decided_at"])
        self.assertEqual(res.data["decided_by"]["url_slug"], "jr_admin")
        self.assertEqual(res.data["user_profile"]["url_slug"], "jr_requester")

    def test_requester_sees_own_without_decided_by(self):
        self.client.force_authenticate(self.requester)
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("decided_by", res.data)

    def test_other_user_member_and_anonymous_denied(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self._url()).status_code, 403)
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get(self._url()).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self._url()).status_code, (401, 403))

    def test_status_mapping_and_empty_message(self):
        req = self._request(self.other)
        self.client.force_authenticate(self.admin)
        res = self.client.get(self._url(req.id))
        self.assertEqual(res.data["request_status"], "pending")
        self.assertEqual(res.data["message"], "")
        self.assertIsNone(res.data["decided_at"])
        self.assertIsNone(res.data["decided_by"])
        req.request_status = RequestStatus.REJECTED.value
        req.rejected_at = timezone.now()
        req.save()
        res = self.client.get(self._url(req.id))
        self.assertEqual(res.data["request_status"], "rejected")
        self.assertIsNotNone(res.data["decided_at"])

    def test_not_found_cases(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self._url(request_id=99999)).status_code, 404)
        self.assertEqual(self.client.get(self._url(slug="nope")).status_code, 404)
        # request belongs to another project
        self.assertEqual(
            self.client.get(self._url(slug=self.other_project.url_slug)).status_code,
            404,
        )
        # organization request
        org = Organization.objects.create(name="O", url_slug="o-jr")
        org_req = MembershipRequests.objects.create(
            user=self.other,
            target_membership_type=MembershipTarget.ORGANIZATION.value,
            target_organization=org,
            availability=self.availability,
            requested_at=timezone.now(),
        )
        self.assertEqual(self.client.get(self._url(org_req.id)).status_code, 404)

    def test_query_count_bounded(self):
        self.join_request.decided_by = self.admin
        self.join_request.save()
        self.client.force_authenticate(self.admin)
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(self.client.get(self._url()).status_code, 200)
        self.assertLess(len(ctx), 15)

    def test_decided_request_cannot_be_redecided(self):
        self.client.force_authenticate(self.admin)
        url = reverse(
            "organization:request-membership-action-entity",
            kwargs={
                "url_slug": self.project.url_slug,
                "request_action": "reject",
                "request_id": self.join_request.id,
            },
        )
        self.assertEqual(self.client.post(url).status_code, 200)
        self.join_request.refresh_from_db()
        decided_at = self.join_request.rejected_at
        url_approve = url.replace("/reject/", "/approve/")
        self.assertEqual(self.client.post(url_approve).status_code, 409)
        self.join_request.refresh_from_db()
        self.assertEqual(self.join_request.request_status, RequestStatus.REJECTED.value)
        self.assertEqual(self.join_request.rejected_at, decided_at)

    def test_list_includes_message_and_requested_at(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get(
            reverse("organization:list-requesters-view", kwargs={"url_slug": "p-jr"})
        )
        self.assertEqual(res.status_code, 200)
        results = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertEqual(results[0]["message"], "Hi there")
        self.assertIn("requested_at", results[0])
