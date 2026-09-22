import logging
from typing import Dict, Union

import pandas as pd
from django.contrib.auth.models import User
from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.db.models import Union as GISUnion
from django.contrib.gis.db.models.functions import Distance
from django.db.models import Q
from django.db.models.functions import Cast

from climateconnect_api.models import Role
from climateconnect_api.models.language import Language
from climateconnect_api.utility.common import create_unique_slug
from climateconnect_api.utility.translation import get_translations
from climateconnect_main.utility.general import get_image_from_data_url
from hubs.models.hub import Hub
from location.utility import get_location
from organization.models import Organization, Project, ProjectMember
from organization.models.type import ProjectTypesChoices

logger = logging.getLogger(__name__)


def apply_hub_filter(queryset, hub_url_slug: str):
    hub = Hub.objects.filter(url_slug=hub_url_slug).first()
    if not hub:
        return queryset.none()

    hubs = [hub]
    if hub.parent_hub:
        hubs.append(hub.parent_hub)

    for current_hub in hubs:
        if current_hub.hub_type == Hub.SECTOR_HUB_TYPE:
            sectors = current_hub.sectors.all()
            sector_ids = [x.id for x in sectors]

            queryset = queryset.filter(
                project_sector_mapping__sector_id__in=sector_ids
            ).distinct()

        elif current_hub.hub_type == Hub.LOCATION_HUB_TYPE:
            hub_locations = current_hub.location.all()

            if not hub_locations.exists():
                return queryset.none()
            else:
                hub_location_ids = hub_locations.values_list("id", flat=True)

                aggregated_geometry = hub_locations.annotate(
                    geom_as_geometry=Cast("multi_polygon", GeometryField())
                ).aggregate(combined=GISUnion("geom_as_geometry"))["combined"]

                queryset = queryset.filter(
                    Q(loc__country=hub_locations.first().country)
                )

                projects_by_location_id = queryset.filter(loc__id__in=hub_location_ids)

                if aggregated_geometry:
                    projects_by_geometry = queryset.filter(
                        Q(loc__centre_point__coveredby=(aggregated_geometry))
                        | Q(loc__multi_polygon__coveredby=(aggregated_geometry))
                    )

                    queryset = (
                        (projects_by_location_id | projects_by_geometry)
                        .annotate(
                            distance=Distance("loc__centre_point", aggregated_geometry)
                        )
                        .distinct()
                    )
                else:
                    queryset = projects_by_location_id.distinct()

        elif current_hub.hub_type == Hub.CUSTOM_HUB_TYPE:
            queryset = queryset.filter(related_hubs=current_hub)

    return queryset


def create_new_project(data: Dict, source_language: Language) -> Project:
    project_kwargs = {
        "name": data["name"],
    }

    if "collaborators_welcome" in data:
        project_kwargs["collaborators_welcome"] = data["collaborators_welcome"]
    project_type_data = data.get("project_type")
    if project_type_data and "type_id" in project_type_data:
        project_kwargs["project_type"] = ProjectTypesChoices[
            project_type_data["type_id"]
        ]

    project = Project.objects.create(**project_kwargs)
    # Add all non required parameters if they exists in the request.
    if "short_description" in data:
        project.short_description = data["short_description"]
    if "start_date" in data:
        project.start_date = data["start_date"]
    if "loc" in data:
        location = get_location(data["loc"])
        project.loc = location
    if "country" in data:
        project.country = data["country"]
    if "city" in data:
        project.city = data["city"]
    if "image" in data:
        project.image = get_image_from_data_url(data["image"])[0]
    if "thumbnail_image" in data:
        project.thumbnail_image = get_image_from_data_url(data["thumbnail_image"])[0]
    if "description_html" in data:
        project.description_html = data["description_html"]
    elif "description" in data:
        from organization.utility.legacy_description_to_tiptap import (
            legacy_description_to_tiptap_html,
        )

        project.description = data["description"]
        project.description_html = legacy_description_to_tiptap_html(
            data["description"]
        )
    if "end_date" in data:
        project.end_date = data["end_date"]
    if "is_draft" in data:
        project.is_draft = data["is_draft"]
    if "is_online" in data:
        project.is_online = data["is_online"]
    if "website" in data:
        project.website = data["website"]
    if "additional_loc_info" in data:
        project.additional_loc_info = data["additional_loc_info"]

    hub_name = data.get("hubName")
    if hub_name:
        hub = Hub.objects.filter(url_slug=hub_name).first()
        if hub:
            project.related_hubs.add(hub)

    if source_language:
        project.language = source_language

    project.url_slug = create_unique_slug(project.name, project.id, Project.objects)

    project.save()
    return project


def get_project_name(project: Project, language_code: str) -> str:
    if (
        project.language
        and language_code != project.language.language_code
        and project.translation_project.filter(
            language__language_code=language_code
        ).exists()
    ):
        return project.translation_project.get(
            language__language_code=language_code
        ).name_translation

    return project.name


def get_project_short_description(project: Project, language_code: str) -> str:
    if (
        project.language
        and language_code != project.language.language_code
        and project.translation_project.filter(
            language__language_code=language_code
        ).exists()
    ):
        return project.translation_project.get(
            language__language_code=language_code
        ).short_description_translation

    return project.short_description


def get_project_description(project: Project, language_code: str) -> str:
    if (
        project.language
        and language_code != project.language.language_code
        and project.translation_project.filter(
            language__language_code=language_code
        ).exists()
    ):
        translation = project.translation_project.get(
            language__language_code=language_code
        )
        return translation.description_html_translation

    return project.description_html


def get_project_translations(data: Dict):
    texts = {"name": data["name"]}
    if "short_description" in data:
        texts["short_description"] = data["short_description"]
    if "description_html" in data:
        texts["description_html"] = data["description_html"]
    elif "description" in data:
        texts["description"] = data["description"]
    try:
        return get_translations(texts, data["translations"], data["source_language"])
    except ValueError:
        raise ValueError


def add_project_member(project, user, user_role, role_in_project, availability):
    """
    Adds a user to a project. Assumes valid data at input.
    """
    ProjectMember.objects.create(
        availability=availability,
        project=project,
        role_in_project=role_in_project,
        role=user_role,
        user=user,
    )


def get_project_admin_creators(project, limit_to_admins=False):
    """
    Returns a given project UserProfiles of Super-Admins or Administrators. if limit_to_admins is set to True, only admins will be returned.
    :param project: target project
    :type project: Project
    :param limit_to_admins: limit output to admins only
    :type limit_to_admins: bool
    """
    targets_roles = Role.objects.filter(
        Q(name="Super-Admin") | Q(name="Administrator")
    ).all()
    if targets_roles.count() < 1:
        raise Exception(
            f"Role 'Super-Admin' or role 'Administrator' doesn't exist: {targets_roles}"
        )

    admin_role, creator_role = (
        targets_roles.filter(name="Administrator").first(),
        targets_roles.filter(name="Super-Admin").first(),
    )

    role_sub_query = (
        Q(role=admin_role)
        if limit_to_admins
        else (Q(role=admin_role) | Q(role=creator_role))
    )
    query = Q(project=project) & role_sub_query

    admins = ProjectMember.objects.filter(query)

    return [u.user for u in admins.all()]


def is_part_of_project(user, project):
    """
    Returns True if user belongs to a project
    :param user: user to be checked
    :type user: User
    :param project: project to be checked
    :type project: ProjectMember
    """
    return ProjectMember.objects.filter(project=project, user=user).count() > 0


def get_similar_projects(url_slug: str, return_count=5, target_projects=None):
    """Returns a list of similar projects to the given project input
    Arguments:
    url_slug (str): url_slug of the source project for which similar projects will returned
    return_count (int) : Maximum number of similar projects to return. Defaults to 5
    target_projects (QuerySet, optional) : Pre-filtered Project queryset to consider
        for similarity. When None, all active non-draft projects with rating >= 49
        are used. Pass a hub-filtered queryset to restrict the candidate pool to a
        specific hub. The queryset should already include the source project so that
        the similarity comparison can read its sector/parent/language attributes.

    Returns:
        List of similar projects url_slug

    """

    def sets_match(source_set: set, target_set: set):
        """returns the % of matching elements from the source set to the target set.
        eg: source:  {1,2,3,4} / target : {3,4,5,6} ==> output : 0.5 (50%)
            source: {3,4} / target : {3,4,5,6} ==> output : 1 (100%)

        """
        source_set_count = len(source_set)
        if source_set_count == 0:
            return 0
        matching_elements = 0
        for source_set_element in source_set:
            if source_set_element in target_set:
                matching_elements += 1

        return matching_elements / source_set_count

    if target_projects is None:
        target_projects = Project.objects.filter(
            is_active=True, is_draft=False, rating__gte=49
        )

    target_projects = target_projects.values(
        "url_slug",
        "project_parent__id",
        "project_sector_mapping__sector_id",
        "language",
    )

    df = pd.DataFrame.from_dict(target_projects)

    # calculate sectors match %
    # since sectors are 1 to Many to projects, we need to group the sector ids in a set per project
    sectors_df = df.groupby(["url_slug"]).agg(
        {"project_sector_mapping__sector_id": set}
    )
    source_sectors = sectors_df.loc[url_slug].iloc[0]

    sectors_df["source_sectors"] = [source_sectors for i in range(0, len(sectors_df))]
    sectors_df["sectors_match"] = sectors_df.apply(
        lambda x: sets_match(
            x["source_sectors"], x["project_sector_mapping__sector_id"]
        ),
        axis=1,
    )

    # calculate parent/language similarity. It is a binary evaluation where 1 means a match and 0 no match
    source_proj_language = df.loc[df.url_slug == url_slug].language.iloc[0]
    source_proj_parent_id = df.loc[df.url_slug == url_slug].project_parent__id.iloc[0]

    df = (
        df.drop(["project_sector_mapping__sector_id"], axis=1)
        .drop_duplicates()
        .set_index("url_slug")
    )

    df["is_same_parent"] = df.project_parent__id.apply(
        lambda x: 1 if x == source_proj_parent_id else 0
    )
    df["is_same_language"] = df.language.apply(
        lambda x: 1 if x == source_proj_language else 0
    )

    # calculate similarity score based on the above calculated features

    # join the dataframes from above on url_slug index and drop the source project
    df = pd.concat(
        [
            df[["is_same_parent", "is_same_language"]],
            sectors_df[["sectors_match"]],
        ],
        axis=1,
    )

    df = df.drop(url_slug)
    # weights given to each factor. Increase the integer value to strengthen the weight of a particular factor
    weights_mapping = {
        "is_same_parent": 3,
        "is_same_language": 2,
        "sectors_match": 3,
    }
    total_weights = sum(weights_mapping.values())
    factors = weights_mapping.keys()

    for factor in factors:
        df[factor] = df[factor] * weights_mapping[factor]

    # calulate the similarity score
    df["similarity_score"] = df.apply(
        lambda x: sum(x) / total_weights, axis=1, raw=True
    )

    return (
        df.sort_values(by=["similarity_score"], ascending=False)
        .head(return_count)
        .index.values
    )


def get_common_related_hub(user: User, content: Union[Project, Organization]):
    user_profile = user.user_profile
    content_related_hubs = content.related_hubs.all()
    user_related_hubs = user_profile.related_hubs.all()
    intersection_of_related_hubs = content_related_hubs & user_related_hubs
    if intersection_of_related_hubs:
        return intersection_of_related_hubs[0].url_slug
    else:
        return None
