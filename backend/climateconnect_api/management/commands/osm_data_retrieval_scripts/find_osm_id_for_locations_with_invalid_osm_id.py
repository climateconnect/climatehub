import requests
import csv
from pathlib import Path
from tqdm import tqdm

# usage of dictionarries because Location moule can't be imported

SEARCH_URL = "https://nominatim.openstreetmap.org/search"
# search only allows 1 request per second, no batch requests
HEADERS = {"User-Agent": "ClimateConnect/1.0 (contact@climateconnect.earth)"}


def discover_osm_id(loc: dict) -> dict | None:
    result = {}
    name = loc.get("name", "").strip()
    id = loc.get("id")
    place_id = loc.get("place_id")

    params = {
        "q": name,
        "format": "json",
        "limit": 1,
        "addressdetails": 0,
        "extratags": 0,
    }

    try:
        response = requests.get(SEARCH_URL, params=params, headers=HEADERS, timeout=20)
        response.raise_for_status()
        data = response.json()
        # best match is data[0]
        if not data:
            print(
                f"Warning: No OSM data found for name: '{name}' (location_id: {loc.id})"
            )
            return None
        d = data[0]
        result = {
            "loc_id": id,
            "place_id": place_id,
            "name": name,
            "display_name": d.get("display_name", ""),
            "osm_type": d.get("osm_type")[0].upper() if d.get("osm_type") else None,
            "osm_id": d.get("osm_id"),
        }

        return result

    except requests.RequestException as e:
        print(f"Error while discovering osm information for '{name}': {e}")

    return None


def create_csv_lookup_table(locs: list[dict], outfile: str) -> None:
    fieldnames = ["loc_id", "place_id", "name", "display_name", "osm_type", "osm_id"]
    outpath = Path(outfile)
    outpath.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(outpath, "w", newline="", encoding="utf-8") as csvout:
            writer = csv.DictWriter(csvout, fieldnames=fieldnames)
            writer.writeheader()
            rows_written = 0

            for i in tqdm(range(len(locs))):
                entry = discover_osm_id(locs[i])
                # the limit of nominatim search is 1 per request and 1 request per second

                if entry:
                    writer.writerow(entry)
                    rows_written += 1

            print(f"\n Successfully saved {rows_written} entries to {outfile}.")

    except Exception as e:
        print(f"Error: {e}")


def open_csv(file_path: str):
    rows = []
    try:
        with open(file_path, mode="r", newline="", encoding="utf-8") as file:
            # csv.DictReader maps the header row to keys in a dictionary for each data row
            reader = csv.DictReader(file)
            if reader.fieldnames:  # clean fieldnames from invisible strings
                cleaned_fieldnames = [
                    name.strip().replace('"', "").replace("\ufeff", "")
                    for name in reader.fieldnames
                ]
                reader.fieldnames = cleaned_fieldnames
            for row in reader:
                rows.append(row)
    except FileNotFoundError:
        raise FileNotFoundError(f"The file '{file_path}' was not found.")
    return rows


def getLocations(osm_path: str, full_db_path: str) -> list[dict]:
    osm_id_rows = open_csv(osm_path)
    full_db_rows = open_csv(full_db_path)
    locations = []

    for row in osm_id_rows:
        osm_id = row["osm_id"]
        for location in full_db_rows:
            if location["osm_id"] == osm_id:
                loc = {
                    "id": location["id"],
                    "place_id": location["place_id"],
                    "name": location["name"],
                }
                locations.append(loc)

    return locations


# csv_db = "path/to/full_db_with_location_id.csv"
# csv_in = "path/to/list_of_all_invalid_osm_ids.csv"
# csv_out = "path/to/output_file_for_lookup_table.csv"
# locations = getLocations(csv_in, csv_db)
# create_csv_lookup_table(locations, csv_out)
