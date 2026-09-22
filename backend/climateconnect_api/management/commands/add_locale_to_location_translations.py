########################################################################################
# IMPORTANT: when adding a new translation language (locale), this locale must also    #
# be added to the languages table in our database                                      #
########################################################################################


import time
from pathlib import Path

import requests
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import QuerySet
from tqdm import tqdm

from climateconnect_api.models.language import Language

# from django.db import transaction
from location.models import Location, LocationTranslation
from location.utility import format_location_name

NOMINATIM_DETAILS_URL = "https://nominatim.openstreetmap.org/lookup"
MAPPING_TABLE_PATH = Path(__file__).parent / "osm_lookup_tables" / "mapping.csv"


def create_name_from_translation_data(
    original_location: Location, translation_data: dict
) -> str:
    name = []
    if original_location.place_name:
        name.append(original_location.place_name)

    if original_location.exact_address:
        name.append(original_location.exact_address)

    for key in ["city_translation", "state_translation", "country_translation"]:
        value = translation_data.get(key)
        if value:
            name.append(value)

    return ", ".join(name)


def get_language_id(locale: str) -> int:
    try:
        language = Language.objects.get(language_code=locale.lower())
        return language.id

    except Exception as e:
        print(f"error: {e}")
        return None


def translate_locations(locs: list["Location"], locale: str):
    if not locs:
        return 0

    language_id = get_language_id(locale)
    batch_size = 50

    locations_created_count = 0

    for i in tqdm(range(0, len(locs), batch_size)):
        batch_locations = locs[i : i + batch_size]
        osm_ids = set()
        unique_translations = {}

        for loc in batch_locations:
            if loc.osm_id and loc.osm_type:
                osm_type = loc.osm_type[0].upper()
                osm_string = f"{osm_type}{loc.osm_id}"
                osm_ids.add(osm_string)
            elif not loc.osm_id:
                print(f"warning: location '{loc.name}' does not have osm_id")
            else:
                print(f"warning: location '{loc.name}' does not have osm_type")

        params = {
            "osm_ids": ",".join(osm_ids),
            "format": "json",
            "extratags": 1,
            "addressdetails": 1,
            "accept-language": locale,
        }

        headers = {"User-Agent": settings.CUSTOM_USER_AGENT}

        # Retry-Logic for Nominatim (503 errors may occur when too many requests are sent)
        max_retries = 3
        retry_delay = 5
        data = None

        for attempt in range(max_retries):
            try:
                response = requests.get(
                    NOMINATIM_DETAILS_URL, params=params, headers=headers, timeout=30
                )
                response.raise_for_status()
                data = response.json()
                break

            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (attempt + 1)
                    tqdm.write(
                        f"Request failed (attempt {attempt + 1}/{max_retries}): {e}"
                    )
                    tqdm.write(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    tqdm.write(
                        f"error with batch request of {len(osm_ids)} osm_ids after {max_retries} attempts: {e}"
                    )
                    continue

        if not data:
            tqdm.write("no data came back from nominatim")
            continue

        # Check response for osm_ids that did not return any result from nominatim
        requested_osm_ids = set(osm_ids)
        returned_osm_ids = set()
        for result in data:
            osm_type = (
                result.get("osm_type", "")[0].upper() if result.get("osm_type") else ""
            )
            osm_id = result.get("osm_id")
            if osm_type and osm_id:
                returned_osm_ids.add(f"{osm_type}{osm_id}")
        missing_osm_ids = requested_osm_ids - returned_osm_ids
        if missing_osm_ids:
            tqdm.write(
                f"warning: no Nominatim result for osm_ids: {', '.join(missing_osm_ids)}"
            )

        time.sleep(1)

        for result in data:
            osm_type = (
                result.get("osm_type", "")[0].upper() if result.get("osm_type") else ""
            )
            osm_id = result.get("osm_id")

            # Direct DB lookup for all matching locations
            matching_locations = Location.objects.filter(
                osm_id=osm_id,
                osm_type=osm_type,
            )
            if not matching_locations.exists():
                print(
                    f"warning: no Location found for OSM identifiers: type={osm_type}, id={osm_id}"
                )
                continue

            address = result.get("address", {})
            translation_data = {
                "city_translation": address.get("city")
                or address.get("town")
                or address.get("village"),
                "state_translation": address.get("state"),
                "country_translation": address.get("country"),
            }

            formatted_name = format_location_name(result).get("name")

            for loc in matching_locations:
                name = formatted_name
                if not name:
                    print(
                        f"warning: could not generate name for location '{loc.name}' with id {loc.id}"
                    )
                    continue

                unique_key = (loc.id, language_id)
                if unique_key not in unique_translations:
                    unique_translations[unique_key] = LocationTranslation(
                        location_id=loc.id,
                        language_id=language_id,
                        name_translation=name,
                        city_translation=translation_data.get("city_translation"),
                        state_translation=translation_data.get("state_translation"),
                        country_translation=translation_data.get("country_translation"),
                    )

        translations_to_create = list(unique_translations.values())

        if translations_to_create:
            try:
                LocationTranslation.objects.bulk_create(
                    translations_to_create, ignore_conflicts=True
                )
                locations_created_count += len(translations_to_create)

            except Exception as e:
                print(f"error: {e}")

    return locations_created_count


class Command(BaseCommand):
    help = "add translations of name into <locale> to LocationTranslation table"

    def add_arguments(self, parser):
        parser.add_argument(
            "locale",
            type=str,
            help="locale of the language that should be added to the LocationTranslation table",
        )
        parser.add_argument(
            "-n",
            "--number",
            type=int,
            help="limits number of translation for testing purposes",
            default=None,
        )

    def handle(self, *args, **options) -> str:
        locale = options.get("locale")
        limit = options.get("number")
        language_id = get_language_id(locale)

        # find locations in DB that need to be translated
        if language_id is None:
            self.stdout.write(
                self.style.ERROR(f"language '{locale}' not found in database")
            )
            return

        locations_to_translate: QuerySet[Location] = Location.objects.exclude(
            translate_location__language_id=language_id
        )

        if limit is not None:
            locations_to_translate = locations_to_translate[:limit]

        locations_list = list(locations_to_translate)
        if not locations_list:
            self.stdout.write(
                self.style.SUCCESS(
                    f"all {len(Location.objects.all())} locations already translated into '{locale}' with language_id: {language_id}."
                )
            )
            return

        self.stdout.write(
            f"Translating {len(locations_list)} locations into '{locale}'..."
        )

        count_before = LocationTranslation.objects.filter(
            language_id=language_id
        ).count()
        # start translation job
        try:
            _ = translate_locations(locations_list, locale)
            count_after = LocationTranslation.objects.filter(
                language_id=language_id
            ).count()
            created_count = count_after - count_before
            self.stdout.write(
                self.style.SUCCESS(f"created {created_count} new translations.")
            )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"{e}"))
