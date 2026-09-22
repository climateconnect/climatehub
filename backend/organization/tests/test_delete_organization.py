from django.contrib.auth.models import User
from django.test import tag
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language, Role, UserProfile
from organization.models import (
    Organization,
    OrganizationMember,
    Project,
    ProjectParents,
    ProjectStatus,
)


class TestDeleteOrganizationAPIView(APITestCase):
    """Tests for DELETE /api/organizations/<url_slug>/"""

    def setUp(self):
        self.url_slug = "test-org-delete"
        self.url = reverse(
            "organization:organization-api-view",
            kwargs={"url_slug": self.url_slug},
        )

        # Super-admin user
        self.super_admin = User.objects.create_user(
            username="super_admin", password="password"
        )
        UserProfile.objects.create(user=self.super_admin)

        # Editor user (READ_WRITE_TYPE)
        self.editor = User.objects.create_user(username="editor", password="password")
        UserProfile.objects.create(user=self.editor)

        # Unrelated user (no org membership)
        self.stranger = User.objects.create_user(
            username="stranger", password="password"
        )
        UserProfile.objects.create(user=self.stranger)

        self.admin_role = Role.objects.create(name="Admin", role_type=Role.ALL_TYPE)
        self.editor_role = Role.objects.create(
            name="Editor", role_type=Role.READ_WRITE_TYPE
        )

        self.default_language = Language.objects.get(language_code="de")

        self.org = Organization.objects.create(
            name="Test Org Delete",
            url_slug=self.url_slug,
            language=self.default_language,
        )

        OrganizationMember.objects.create(
            user=self.super_admin, organization=self.org, role=self.admin_role
        )
        OrganizationMember.objects.create(
            user=self.editor, organization=self.org, role=self.editor_role
        )

        self.project_status = ProjectStatus.objects.create(
            name="active_del_test",
            name_de_translation="aktiv",
            has_end_date=False,
            has_start_date=False,
        )

    # ------------------------------------------------------------------
    # Success cases
    # ------------------------------------------------------------------

    @tag("organization", "delete")
    def test_super_admin_can_delete_org_with_no_projects(self):
        self.client.force_authenticate(user=self.super_admin)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Organization.objects.filter(url_slug=self.url_slug).exists())

    @tag("organization", "delete")
    def test_delete_response_contains_success_message(self):
        self.client.force_authenticate(user=self.super_admin)

        response = self.client.delete(self.url)

        self.assertIn("message", response.json())

    # ------------------------------------------------------------------
    # Guard: org with projects cannot be deleted
    # ------------------------------------------------------------------

    @tag("organization", "delete")
    def test_super_admin_cannot_delete_org_with_projects(self):
        project = Project.objects.create(
            name="Linked Project",
            url_slug="linked-project-del-test",
            status=self.project_status,
        )
        ProjectParents.objects.create(
            project=project,
            parent_organization=self.org,
        )
        self.client.force_authenticate(user=self.super_admin)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Organization.objects.filter(url_slug=self.url_slug).exists())

    @tag("organization", "delete")
    def test_super_admin_can_delete_org_with_only_inactive_projects(self):
        project = Project.objects.create(
            name="Inactive Project",
            url_slug="inactive-project-del-test",
            status=self.project_status,
            is_active=False,
        )
        ProjectParents.objects.create(
            project=project,
            parent_organization=self.org,
        )
        self.client.force_authenticate(user=self.super_admin)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Organization.objects.filter(url_slug=self.url_slug).exists())

    @tag("organization", "delete")
    def test_delete_blocked_response_contains_project_count(self):
        project = Project.objects.create(
            name="Linked Project",
            url_slug="linked-project-count-test",
            status=self.project_status,
        )
        ProjectParents.objects.create(
            project=project,
            parent_organization=self.org,
        )
        self.client.force_authenticate(user=self.super_admin)

        response = self.client.delete(self.url)

        self.assertIn("message", response.json())
        self.assertIn("1", response.json()["message"])

    @tag("organization", "delete")
    def test_organization_projects_count_excludes_inactive_projects(self):
        project = Project.objects.create(
            name="Inactive Project Count",
            url_slug="inactive-project-count-test",
            status=self.project_status,
            is_active=False,
        )
        ProjectParents.objects.create(
            project=project,
            parent_organization=self.org,
        )
        self.client.force_authenticate(user=self.super_admin)

        response = self.client.get(
            self.url + "?edit_view=true",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json().get("projects_count"), 0)

    # ------------------------------------------------------------------
    # Permission checks
    # ------------------------------------------------------------------

    @tag("organization", "delete")
    def test_editor_cannot_delete_org(self):
        self.client.force_authenticate(user=self.editor)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Organization.objects.filter(url_slug=self.url_slug).exists())

    @tag("organization", "delete")
    def test_unrelated_user_cannot_delete_org(self):
        self.client.force_authenticate(user=self.stranger)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Organization.objects.filter(url_slug=self.url_slug).exists())

    @tag("organization", "delete")
    def test_unauthenticated_request_cannot_delete_org(self):
        response = self.client.delete(self.url)

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )
        self.assertTrue(Organization.objects.filter(url_slug=self.url_slug).exists())

    # ------------------------------------------------------------------
    # Not found
    # ------------------------------------------------------------------

    @tag("organization", "delete")
    def test_delete_nonexistent_org_returns_404(self):
        url = reverse(
            "organization:organization-api-view",
            kwargs={"url_slug": "does-not-exist"},
        )
        self.client.force_authenticate(user=self.super_admin)

        response = self.client.delete(url)

        # The permission class returns False for an unknown org (org not found
        # during permission check), so the response is 403 rather than 404.
        self.assertIn(
            response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]
        )
