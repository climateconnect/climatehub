from organization.models.organization import Organization
from organization.models.sector import OrganizationSectorMapping
from django.core.management.base import BaseCommand
from typing import Any


class Command(BaseCommand):
    help = "Creates OrganizationSectorMappings for all organizations and sectors."

    def handle(self, *args: Any, **options: Any) -> None:
        print("Total organization: {}".format(Organization.objects.count()))
        org_counter = 0
        for organization in Organization.objects.all():
            if OrganizationSectorMapping.objects.filter(
                organization=organization
            ).exists():
                print(
                    "Organization {} already has sector mappings.".format(
                        organization.id
                    )
                )
            else:
                print(
                    "Creating sector mappings for organization {}.".format(
                        organization.id
                    )
                )
                hubs = organization.hubs.all()
                for hub in hubs:
                    if hub.sectors.exists():
                        for sector in hub.sectors.all():
                            (
                                mapping,
                                created,
                            ) = OrganizationSectorMapping.objects.get_or_create(
                                organization=organization, sector=sector
                            )
                            if created:
                                print(
                                    "Created mapping for organization {} and sector {}.".format(
                                        organization.id, sector.key
                                    )
                                )
                    else:
                        print(
                            "Hub {} has no sector associated, skipping.".format(hub.id)
                        )
                org_counter += 1

        print("Total organization updated: {}".format(org_counter))
