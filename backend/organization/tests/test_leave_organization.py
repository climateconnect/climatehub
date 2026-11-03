from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language, Role, UserProfile
from organization.models import Organization, OrganizationMember


class TestLeaveOrganization(APITestCase):
    """Tests for POST /api/organizations/<url_slug>/leave/"""

    def _user(self, name):
        user = User.objects.create_user(username=name, password="password")
        UserProfile.objects.create(user=user)
        return user

    def setUp(self):
        self.slug = "leave-org"
        self.url = reverse(
            "organization:leave-organization", kwargs={"url_slug": self.slug}
        )
        self.super_admin = self._user("super_admin")
        self.admin = self._user("admin")
        self.member = self._user("member")
        self.other_member = self._user("other_member")
        self.stranger = self._user("stranger")

        self.super_role = Role.objects.create(
            name="Super-Admin", role_type=Role.ALL_TYPE
        )
        self.admin_role = Role.objects.create(name="Admin", role_type=Role.ALL_TYPE)
        self.member_role = Role.objects.create(
            name="Member", role_type=Role.READ_ONLY_TYPE
        )

        self.org = Organization.objects.create(
            name="Leave Org",
            url_slug=self.slug,
            language=Language.objects.get(language_code="de"),
        )
        self.memberships = {
            u: OrganizationMember.objects.create(user=u, organization=self.org, role=r)
            for u, r in [
                (self.super_admin, self.super_role),
                (self.admin, self.admin_role),
                (self.member, self.member_role),
                (self.other_member, self.member_role),
            ]
        }

    def _exists(self, user):
        return OrganizationMember.objects.filter(
            user=user, organization=self.org
        ).exists()

    def test_member_leaves(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(self._exists(self.member))
        self.assertTrue(self._exists(self.other_member))
        self.assertTrue(self._exists(self.admin))

    def test_admin_leaves(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(self._exists(self.admin))

    def test_super_admin_with_other_members_blocked(self):
        self.client.force_authenticate(user=self.super_admin)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["message"], "A new Super-Admin needs to be assigned first"
        )
        self.assertTrue(self._exists(self.super_admin))

    def test_last_super_admin_blocked(self):
        OrganizationMember.objects.exclude(user=self.super_admin).delete()
        self.client.force_authenticate(user=self.super_admin)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Delete the organization", response.data["message"])
        self.assertTrue(self._exists(self.super_admin))
        self.assertTrue(Organization.objects.filter(url_slug=self.slug).exists())

    def test_non_member_gets_404(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unknown_slug_gets_404(self):
        self.client.force_authenticate(user=self.member)
        url = reverse("organization:leave-organization", kwargs={"url_slug": "nope"})
        self.assertEqual(self.client.post(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_gets_401(self):
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_only_own_membership_affected(self):
        self.client.force_authenticate(user=self.member)
        self.client.post(self.url)
        for user in (self.other_member, self.admin, self.super_admin):
            self.assertTrue(self._exists(user))
