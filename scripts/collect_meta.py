#!/usr/bin/env python3
"""Collect meta tags (title, description, OG, Twitter) from climatehub.org pages in EN and DE."""

import csv
import time
import sys
from datetime import datetime

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://climatehub.org"

STATIC_PAGES = [
    "/",
    "/about",
    "/browse",
    "/blog",
    "/climatehubs",
    "/donate",
    "/donorforest",
    "/events",
    "/faq",
    "/hubs",
    "/imprint",
    "/jobs",
    "/login",
    "/members",
    "/organizations",
    "/press",
    "/privacy",
    "/share",
    "/stream",
    "/team",
    "/terms",
    "/transparency",
    "/verein",
    "/zoom",
]

LOCATION_HUBS = ["erlangen", "em", "kassel", "potsdam", "emmendingen", "wuerzburg"]
CUSTOM_HUBS = ["prio1", "perth"]
ALL_HUBS = LOCATION_HUBS + CUSTOM_HUBS

HUB_SUBPAGES = [
    "",           # landing page
    "/browse",
    "/members",
    "/organizations",
]

LOCALES = {
    "en": "",       # English: no prefix
    "de": "/de",    # German: /de prefix
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MetaAuditBot/1.0)",
    "Accept": "text/html",
}

META_KEYS = [
    "title",
    "description",
    "og:title",
    "og:description",
    "og:image",
    "og:type",
    "og:url",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
]


def extract_meta(html: str) -> dict[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    result: dict[str, str] = {}

    title_tag = soup.find("title")
    result["title"] = title_tag.get_text(strip=True) if title_tag else ""

    for tag in soup.find_all("meta"):
        name = tag.get("name", "").lower()
        prop = tag.get("property", "").lower()
        content = tag.get("content", "")
        key = name or prop
        if key in META_KEYS and content:
            result.setdefault(key, content)

    return result


def fetch_page(url: str) -> str | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        if resp.status_code == 200:
            return resp.text
        print(f"  WARN {resp.status_code} for {url}", file=sys.stderr)
        return None
    except requests.RequestException as e:
        print(f"  ERR  {e} for {url}", file=sys.stderr)
        return None


def collect(page_path: str, locale: str, prefix: str) -> dict:
    url = f"{BASE_URL}{prefix}{page_path}"
    print(f"Fetching {url} ...", file=sys.stderr)
    html = fetch_page(url)
    if html is None:
        meta = {k: "" for k in META_KEYS}
        meta["title"] = "[FETCH FAILED]"
    else:
        meta = extract_meta(html)
    return {"page": page_path, "locale": locale, "url": url, **meta}


def main():
    rows = []

    # 1. Static pages
    for page_path in STATIC_PAGES:
        for locale, prefix in LOCALES.items():
            rows.append(collect(page_path, locale, prefix))
            time.sleep(0.3)

    # 2. Hub landing + sub-pages (browse, members, organizations)
    for hub in ALL_HUBS:
        for sub in HUB_SUBPAGES:
            page_path = f"/hubs/{hub}{sub}"
            for locale, prefix in LOCALES.items():
                rows.append(collect(page_path, locale, prefix))
                time.sleep(0.3)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    out_path = f"doc/meta_audit_{timestamp}.csv"
    fieldnames = ["page", "locale", "url"] + META_KEYS
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDone — {len(rows)} rows written to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
