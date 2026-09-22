from typing import Dict

from django.utils.translation import gettext as _

from climateconnect_api.models.language import Language
from organization.models import (
    Organization,
    ProjectParents,
    OrganizationTranslation,
    OrganizationMember,
)
from organization.models.tags import OrganizationTags


def check_organization(organization_id: str) -> Organization:
    try:
        organization = Organization.objects.get(id=int(organization_id))
    except Organization.DoesNotExist:
        organization = None
    return organization


def get_organization_name(organization: Organization, language_code: str) -> str:
    if (
        organization.language
        and language_code != organization.language.language_code
        and organization.translation_org.filter(
            language__language_code=language_code
        ).exists()
    ):
        name_translation = (
            organization.translation_org.filter(language__language_code=language_code)
            .first()
            .name_translation
        )

        if name_translation and len(name_translation) > 0:
            return name_translation

    return organization.name


def get_organization_short_description(
    organization: Organization, language_code: str
) -> str:
    if (
        organization.language
        and language_code != organization.language.language_code
        and organization.translation_org.filter(
            language__language_code=language_code
        ).exists()
    ):
        return (
            organization.translation_org.filter(language__language_code=language_code)
            .first()
            .short_description_translation
        )

    return organization.short_description


def get_organization_get_involved(
    organization: Organization, language_code: str
) -> str:
    if (
        organization.language
        and language_code != organization.language.language_code
        and organization.translation_org.filter(
            language__language_code=language_code
        ).exists()
    ):
        return (
            organization.translation_org.filter(language__language_code=language_code)
            .first()
            .get_involved_translation
        )

    return organization.get_involved


def get_organization_about_section(
    organization: Organization, language_code: str
) -> str:
    if (
        organization.language
        and language_code != organization.language.language_code
        and organization.translation_org.filter(
            language__language_code=language_code
        ).exists()
    ):
        return organization.translation_org.get(
            language__language_code=language_code
        ).about_translation

    return organization.about


def get_organizationtag_name(tag: OrganizationTags, language_code: str) -> str:
    lang_translation_attr = "name_{}_translation".format(language_code)
    if hasattr(tag, lang_translation_attr):
        translation = getattr(tag, lang_translation_attr)
        if language_code != "en" and translation is not None:
            return translation
    return tag.name


def create_organization_translation(
    organization: Organization,
    language: Language,
    texts: Dict,
    is_manual_translation: bool,
) -> None:
    org_translation = OrganizationTranslation.objects.create(
        organization=organization,
        language=language,
        name_translation=texts["name"].strip(),  # remove leading and trailing spaces
        is_manual_translation=is_manual_translation,
    )
    if "short_description" in texts:
        org_translation.short_description_translation = texts["short_description"]
    if "about" in texts:
        org_translation.about_translation = texts["about"]
    if "get_involved" in texts:
        org_translation.get_involved_translation = texts["get_involved"]

    org_translation.save()


def is_valid_organization_size(org_size) -> bool:
    for size_option in Organization.ORGANIZATION_SIZE_OPTIONS:
        if size_option[0] == org_size:
            return True
    return False


def add_organization_member(organization, user, user_role, role_in_organization):
    OrganizationMember.objects.create(
        organization=organization,
        user=user,
        role=user_role,
        role_in_organization=role_in_organization,
    )

    return


def check_edit_exisiting_name(organization, name):
    # allows an org to change capitilization of their name
    if (
        Organization.objects.filter(name__iexact=name)
        .exclude(id=organization.id)
        .exists()
    ):
        return True

    if OrganizationTranslation.objects.filter(name_translation__iexact=name).exclude(
        organization=organization
    ):
        return True

    return False


def check_create_existing_name(name):
    if check_existing_name(name) or check_existing_name_translation(name):
        return True
    return False


def check_existing_name(name):
    if Organization.objects.filter(name__iexact=name).exists():
        return True
    return False


def check_existing_name_translation(name):
    if OrganizationTranslation.objects.filter(name_translation__iexact=name).exists():
        return True
    return False


def get_existing_name_message(name):
    return _(
        "Someone has already created the organization {}. Please join the organization or use a different name. If you're having problems please contact support@climatehub.org"
    ).format(name)


def get_visible_organization_projects_queryset(organization: Organization):
    return ProjectParents.objects.filter(
        parent_organization=organization,
        project__is_draft=False,
        project__is_active=True,
    )
