# import time
import csv
from pathlib import Path

import requests
from tqdm import tqdm

LOCATIONS_URL = "https://nominatim.openstreetmap.org/lookup"
HEADERS = {"User-Agent": "ClimateConnect/1.0 (contact@climateconnect.earth)"}


def discover_osm_type(osm_ids: list) -> tuple[dict, set] | None:
    # input list of max 16 osm_ids due to limitation of nominatim requests (see below)
    results = {}
    ids_with_multiple_possible_types = []

    valid_osm_ids = set()
    invalid_osm_ids = set()
    # also create list for osm_ids that are totally invalid, no results found

    osm_ids_with_types = []
    for osm_id in osm_ids:
        osm_id_str = str(osm_id)
        for type_prefix in "RWN":
            # here RNW would be better instead of RWN (see comment below)
            osm_ids_with_types.append(type_prefix + osm_id_str)

    osm_ids_string = ",".join(osm_ids_with_types)

    params = {"osm_ids": osm_ids_string, "format": "json", "extratags": 0}

    try:
        response = requests.get(
            LOCATIONS_URL, params=params, headers=HEADERS, timeout=20
        )

        response.raise_for_status()
        data = response.json()
        # data is type of array
        for d in data:
            if d["osm_id"] in results:
                dup_osm_id = d["osm_id"]
                ids_with_multiple_possible_types.append(dup_osm_id)
                continue

            valid_osm_ids.add(int(d["osm_id"]))

            results[d["osm_id"]] = {
                "osm_type": d["osm_type"][0].upper(),
                "osm_id": d["osm_id"],
                "name": d["display_name"],
            }

        # if len(ids_with_multiple_possible_types) != 0:
        #     print(
        #         f"WARNING: osm_ids with multiple possible types found: {ids_with_multiple_possible_types}"
        #     )

        # Commentor: Kathi
        # here I reviewed every osm_id with multipe possible types manually and compared the name in the database with the 'display_name'
        # this was a lot of work, so maybe think of some automation for future execution of this script (problem:
        #         sometimes the 'name' and 'display_name' are not exactly equal)
        # the order RNW is suggested instead of RWN
        # reason: the first match was written to lookup, R was the right type a lot of times compared to N,
        #         and N was the right type most of the times compared to W

        # some osm_ids are not valid anymore, find and return them
        for id in osm_ids:
            if int(id) not in valid_osm_ids:
                invalid_osm_ids.add(id)

        return results, invalid_osm_ids

    except requests.RequestException as e:
        print(f"Error while discovering osm_type for osm_id {osm_id}: {e}")

    return None


def create_csv_lookup_table(osm_ids: list, outfile: str) -> None:
    fieldnames = ["osm_type", "osm_id", "name"]
    outpath = Path(outfile)
    outpath.parent.mkdir(parents=True, exist_ok=True)

    invalid_osm_ids = set()

    try:
        with open(outpath, "w", newline="", encoding="utf-8") as csvout:
            writer = csv.DictWriter(csvout, fieldnames=fieldnames)
            writer.writeheader()
            rows_written = 0

            for i in tqdm(range(0, len(osm_ids), 16)):
                result = discover_osm_type(osm_ids[i : i + 16])
                if not result:
                    continue
                entries, invalids = result
                # the limiit of nominatim lookup is 50 per request, hence 16 is the most osm_ids that
                # can be sent at once (3 osm_types per osm_id are queried)

                invalid_osm_ids.update(invalids)

                for entry in entries.values():
                    writer.writerow(entry)
                    rows_written += 1

            print(f"\n Successfully saved {rows_written} entries to {outfile}.")

    except Exception as e:
        print(f"Error: {e}")

    invalids_path = outpath.parent / "invalid_osm_ids_file.csv"
    write_invalid_osm_ids_to_file(invalid_osm_ids, invalids_path)


def write_invalid_osm_ids_to_file(invalid_osm_ids: set[str], outfile: str):
    outpath = Path(outfile)
    fieldnames = ["osm_id"]
    try:
        with open(outpath, "w", newline="", encoding="utf-8") as csvout:
            writer = csv.DictWriter(csvout, fieldnames=fieldnames)
            writer.writeheader()
            rows_written = 0

            for osm_id in tqdm(invalid_osm_ids):
                writer.writerow({"osm_id": osm_id})
                rows_written += 1

            print(f"\n Successfully saved {rows_written} osm_ids to {outfile}.")

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
                if row["osm_id"]:
                    try:
                        osm_id_str = row["osm_id"].strip()
                        if osm_id_str.isdigit():
                            unique_osm_ids.add(osm_id_str)
                        else:
                            print(f"WARNING: non-numeric osm_id: {osm_id_str}")

                    except ValueError:
                        print(f"Warning: invalid osm_id '{row['osm_id']}' skipped.")
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
test_osm_ids = extract_osm_ids("path/to/database_table.csv")
csv_path = "path/to/output_lookup.csv"
create_csv_lookup_table(test_osm_ids, csv_path)
