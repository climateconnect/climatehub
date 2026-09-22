from organization.models.project import Project
from organization.models.tags import ProjectTagging
from organization.models.sector import ProjectSectorMapping, Sector
from django.core.management.base import BaseCommand
from typing import Any


class Sector_Definition:
    def __init__(self, name, de_translated_name, key):
        self.name = name
        self.de_translated_name = de_translated_name
        self.key = key


class Command(BaseCommand):
    help = "Creates ProjectSectorMappings for all projects and sectors."

    def handle(self, *args: Any, **options: Any) -> None:
        SECTOR_DEFINITIONS = {
            x.key: x
            for x in [
                Sector_Definition(
                    "Food & Agriculture",
                    "Ernährung & Landwirtschaft",
                    "food",
                ),
                Sector_Definition(
                    "Building & Housing",
                    "Bauen und Wohnen",
                    "housing",
                ),
                Sector_Definition(
                    "Energy",
                    "Energie",
                    "energy",
                ),
                Sector_Definition(
                    "Politics & Activism",
                    "Politik und Aktivismus",
                    "policy",
                ),
                Sector_Definition(
                    "Education",
                    "Bildung",
                    "education",
                ),
                Sector_Definition(
                    "Mobility",
                    "Mobilität",
                    "mobility",
                ),
                Sector_Definition(
                    "Nature & Biodiversity",
                    "Natur und Biodiversität",
                    "nature",
                ),
                Sector_Definition(
                    "Resources & Consumption",
                    "Konsum & Resourcen",
                    "resources",
                ),
                Sector_Definition(
                    "Climate Adaption",
                    "Klimaanpassung",
                    "adaption",
                ),
            ]
        }
        DELETION_TOKEN = "DELETION_TOKEN"

        MAPPING = {
            "Air": DELETION_TOKEN,
            "Buildings": SECTOR_DEFINITIONS["housing"],
            "Education on climate change adaption": SECTOR_DEFINITIONS["education"],
            "Climate change adaption": SECTOR_DEFINITIONS["adaption"],
            "Climate justice": SECTOR_DEFINITIONS["policy"],
            "Demonstrations & strikes": SECTOR_DEFINITIONS["policy"],
            "Petition": SECTOR_DEFINITIONS["policy"],
            "Education & Social action": SECTOR_DEFINITIONS["education"],
            "Energy": SECTOR_DEFINITIONS["energy"],
            "Food": SECTOR_DEFINITIONS["food"],
            "Funding": DELETION_TOKEN,
            "Geoengineering": SECTOR_DEFINITIONS["adaption"],
            "Climate-friendly agriculture": SECTOR_DEFINITIONS["food"],
            "Land use": SECTOR_DEFINITIONS["nature"],
            "Policy & Governance": SECTOR_DEFINITIONS["policy"],
            "Product": DELETION_TOKEN,
            "Production, consumption and recycling": SECTOR_DEFINITIONS["resources"],
            "Research": DELETION_TOKEN,
            "Mobility": SECTOR_DEFINITIONS["mobility"],
            "Water": SECTOR_DEFINITIONS["resources"],  # TODO
            "Fighting ocean acidification": SECTOR_DEFINITIONS["nature"],
            "Protecting marine ecosystems": SECTOR_DEFINITIONS["nature"],
            "Event": DELETION_TOKEN,
        }

        print("Total projects: {}".format(Project.objects.count()))
        proj_counter = 0
        for project in Project.objects.all():
            if ProjectSectorMapping.objects.filter(project=project).exists():
                print("Project {} already has sector mappings.".format(project.id))
            else:
                print("Creating sector mappings for project {}.".format(project.id))
                taggings = ProjectTagging.objects.filter(project=project)
                for tagging in taggings:
                    tag = tagging.project_tag
                    if tag.name not in MAPPING and tag.parent_tag is not None:
                        tag = tag.parent_tag
                    if tag.name in MAPPING:
                        sector = MAPPING[tag.name]
                        if sector == DELETION_TOKEN:
                            print("Skipping deletion token for tag {}".format(tag.name))
                            continue
                        else:
                            sector = Sector.objects.get(key=sector.key)
                            (
                                mapping,
                                created,
                            ) = ProjectSectorMapping.objects.get_or_create(
                                project=project, sector=sector
                            )
                        if created:
                            print(
                                "Created mapping for project {} and sector {}.".format(
                                    project.id, sector.key
                                )
                            )
                        proj_counter += 1
                    else:
                        print("Tag {} not found in mapping, skipping.".format(tag.name))
                        print(tag.parent_tag)

        print("Total projects updated: {}".format(proj_counter))
