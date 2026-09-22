### IMPORTANT NOTICE: ###########################################################################
# Run this script after getting the osm_type, because it uses the osm_type to find the osm_class#
#################################################################################################

# import time
import csv
from pathlib import Path

import requests
from tqdm import tqdm

LOCATIONS_URL = "https://nominatim.openstreetmap.org/lookup"
HEADERS = {"User-Agent": "ClimateConnect/1.0 (contact@climateconnect.earth)"}


def discover_osm_class(osm_ids: list) -> tuple[dict, set] | None:
    # max 50 osm_ids
    results = {}
    osm_ids_string = ",".join(osm_ids)

    params = {"osm_ids": osm_ids_string, "format": "json", "extratags": 0}

    try:
        response = requests.get(
            LOCATIONS_URL, params=params, headers=HEADERS, timeout=20
        )

        response.raise_for_status()
        data = response.json()
        # data is type of array
        for d in data:
            results[d["osm_id"]] = {
                "osm_id": d["osm_id"],
                "osm_type": d["osm_type"][0].upper(),
                "display_name": d["display_name"],
                "osm_class": d["class"],
                "osm_class_type": d["type"],
            }

        return results

    except requests.RequestException as e:
        print(f"Error while discovering osm_class for osm_ids {osm_ids}: {e}")

    return None


def create_csv_lookup_table(osm_ids: list, outfile: str) -> None:
    fieldnames = ["osm_type", "osm_id", "osm_class", "osm_class_type", "display_name"]
    outpath = Path(outfile)
    outpath.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(outpath, "w", newline="", encoding="utf-8") as csvout:
            writer = csv.DictWriter(csvout, fieldnames=fieldnames)
            writer.writeheader()
            rows_written = 0

            for i in tqdm(range(0, len(osm_ids), 50)):
                result = discover_osm_class(osm_ids[i : i + 50])
                if not result:
                    continue

                # the limit of nominatim lookup is 50 per request

                for entry in result.values():
                    writer.writerow(entry)
                    rows_written += 1

            print(f"\n Successfully saved {rows_written} entries to {outfile}.")

    except Exception as e:
        print(f"Error: {e}")


def extract_osm_ids(csv_path):
    path = Path(csv_path)
    unique_osm_ids = set()
    if not path.exists():
        print(f"Error: path not found: {path}")
        return []
    try:
        with open(path, mode="r", newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            if reader.fieldnames:  # clean fieldnames from invisible strings
                cleaned_fieldnames = [
                    name.strip().replace('"', "").replace("\ufeff", "")
                    for name in reader.fieldnames
                ]
                reader.fieldnames = cleaned_fieldnames
            for row in reader:
                if row["osm_id"] and row["osm_type"]:
                    try:
                        osm_id_str = row["osm_type"] + row["osm_id"].strip()
                        unique_osm_ids.add(osm_id_str)
                    except ValueError:
                        print(
                            f"Warning: invalid osm_id '{row['osm_type']}{row['osm_id']}' skipped."
                        )
                        continue

        print(
            f"{len(unique_osm_ids)} unique osm_id's successfully extracted from {path}."
        )

        return sorted(list(unique_osm_ids))

    except Exception as e:
        print(f"Error: {e}")
        return []


# queryset = Location.objects.filter(osm_type__isnull=True, place_id__isnull=False)
# all_place_ids = list(queryset.values_list('place_id', flat=True).distinct())
# test_place_ids = all_place_ids[0:10]
# test_place_ids = [281739181, 88715228, 256856867, 256305646, 82615589, 83293355, 115047027, 297417241, 307525758, 258543476]
# test_osm_ids = [7444, 8649, 16132]
test_osm_ids = []
test_osm_ids.extend(extract_osm_ids("path/to/locations_gone_wrong.csv"))
test_osm_ids.extend(extract_osm_ids("path/to/locations_gone_wrong_class.csv"))
csv_path = "path/to/class_lookup_final_ones.csv"
create_csv_lookup_table(test_osm_ids, csv_path)
