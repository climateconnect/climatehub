from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, tag
from django.urls import reverse
from django.utils import timezone

from climateconnect_api.models import Availability
from organization.models import Organization, Project
from organization.models.members import MembershipRequests
from organization.utility import MembershipTarget, RequestStatus


@tag("membership_requests_admin")
class MembershipRequestsAdminBase(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="site_admin", email="admin@test.com", password="testpassword"
        )
        self.client.force_login(self.admin_user)

        self.availability = Availability.objects.create(
            name="1-3 hours", key="1-3-hours"
        )
        self.requester = User.objects.create_user(
            username="requester",
            email="requester@test.com",
            password="testpassword",
            first_name="Rita",
            last_name="Requester",
        )
        self.project = Project.objects.create(
            name="Test Project", url_slug="test-project"
        )
        self.organization = Organization.objects.create(
            name="Test Organization", url_slug="test-organization"
        )

    def _create_request(
        self,
        user=None,
        target=MembershipTarget.PROJECT,
        status=RequestStatus.PENDING,
        **kwargs,
    ):
        params = dict(
            user=user or self.requester,
            target_membership_type=target.value,
            availability=self.availability,
            requested_at=timezone.now(),
            request_status=status.value,
        )
        if target == MembershipTarget.PROJECT:
            params["target_project"] = self.project
        else:
            params["target_organization"] = self.organization
        params.update(kwargs)
        return MembershipRequests.objects.create(**params)

    def _changelist(self, query=""):
        url = reverse("admin:organization_membershiprequests_changelist")
        return self.client.get(f"{url}{query}")

    def _rows(self, response):
        return list(response.context["cl"].result_list)


class TestMembershipRequestsAdminChangelist(MembershipRequestsAdminBase):
    def test_changelist_reachable(self):
        response = self._changelist()
        self.assertEqual(response.status_code, 200)

    def test_add_page_reachable(self):
        url = reverse("admin:organization_membershiprequests_add")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_change_page_reachable(self):
        request = self._create_request()
        url = reverse("admin:organization_membershiprequests_change", args=[request.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            f"Membership request by {self.requester.username} to join {self.project.name}",
        )

    def test_changelist_shows_requested_columns(self):
        self._create_request(target=MembershipTarget.PROJECT)
        response = self._changelist()
        self.assertContains(response, "Requesting user")
        self.assertContains(response, self.requester.username)
        self.assertContains(response, self.project.name)
        self.assertContains(response, "PENDING")
        self.assertContains(response, "Requested at")

    def test_changelist_lists_project_and_organization_requests(self):
        self._create_request(target=MembershipTarget.PROJECT)
        self._create_request(
            target=MembershipTarget.ORGANIZATION, status=RequestStatus.APPROVED
        )
        response = self._changelist()
        self.assertContains(response, self.project.name)
        self.assertContains(response, self.organization.name)
        self.assertContains(response, "APPROVED")
        self.assertEqual(len(self._rows(response)), 2)

    def test_optional_project_column_empty_for_organization_request(self):
        self._create_request(target=MembershipTarget.ORGANIZATION)
        response = self._changelist()
        self.assertContains(response, self.organization.name)
        self.assertNotContains(response, self.project.name)
        rows = self._rows(response)
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0].target_project)

    def test_optional_organization_column_empty_for_project_request(self):
        self._create_request(target=MembershipTarget.PROJECT)
        response = self._changelist()
        self.assertContains(response, self.project.name)
        self.assertNotContains(response, self.organization.name)
        rows = self._rows(response)
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0].target_organization)

    def test_search_by_username(self):
        self._create_request(target=MembershipTarget.PROJECT)
        self._create_request(target=MembershipTarget.ORGANIZATION)
        response = self._changelist("?q=requester")
        self.assertEqual(len(self._rows(response)), 2)

    def test_search_by_user_email(self):
        self._create_request(target=MembershipTarget.PROJECT)
        self._create_request(target=MembershipTarget.ORGANIZATION)
        response = self._changelist("?q=requester@test.com")
        self.assertEqual(len(self._rows(response)), 2)

    def test_search_by_project_name(self):
        self._create_request(target=MembershipTarget.PROJECT)
        self._create_request(target=MembershipTarget.ORGANIZATION)
        response = self._changelist("?q=Test Project")
        rows = self._rows(response)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].target_project, self.project)

    def test_search_by_organization_name(self):
        self._create_request(target=MembershipTarget.PROJECT)
        self._create_request(target=MembershipTarget.ORGANIZATION)
        response = self._changelist("?q=Test Organization")
        rows = self._rows(response)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].target_organization, self.organization)

    def test_filter_by_request_status(self):
        self._create_request(target=MembershipTarget.PROJECT)
        self._create_request(
            target=MembershipTarget.ORGANIZATION, status=RequestStatus.APPROVED
        )
        response = self._changelist("?request_status__exact=2")
        rows = self._rows(response)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].request_status, RequestStatus.APPROVED.value)

    def test_filter_by_membership_target(self):
        self._create_request(target=MembershipTarget.PROJECT)
        self._create_request(target=MembershipTarget.ORGANIZATION)
        response = self._changelist("?target_membership_type__exact=2")
        rows = self._rows(response)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].target_project, self.project)

    def test_ordered_newest_first(self):
        second_user = User.objects.create_user(
            username="requester2", password="testpassword"
        )
        older = self._create_request(requested_at=timezone.now() - timedelta(days=1))
        newer = self._create_request(user=second_user, requested_at=timezone.now())
        response = self._changelist()
        self.assertEqual(self._rows(response), [newer, older])


class TestMembershipRequestsStr(MembershipRequestsAdminBase):
    def test_str_for_project_request(self):
        request = self._create_request(target=MembershipTarget.PROJECT)
        self.assertEqual(
            str(request),
            f"Membership request by {self.requester.username} to join {self.project.name}",
        )

    def test_str_for_organization_request(self):
        request = self._create_request(target=MembershipTarget.ORGANIZATION)
        self.assertEqual(
            str(request),
            f"Membership request by {self.requester.username} to join {self.organization.name}",
        )

    def test_str_for_request_without_target(self):
        request = MembershipRequests.objects.create(
            user=self.requester,
            target_membership_type=MembershipTarget.PROJECT.value,
            availability=self.availability,
            requested_at=timezone.now(),
            request_status=RequestStatus.PENDING.value,
        )
        self.assertEqual(
            str(request),
            f"Membership request by {self.requester.username} to join unknown target",
        )
