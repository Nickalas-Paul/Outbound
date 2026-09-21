"""
Ingest UK FCDO foreign travel advice into raw_indicators.

API: https://www.gov.uk/api/content/foreign-travel-advice
Writes source=fcdo, indicator_code=fcdo_advisory_level (1–4).

FCDO alert_status → numeric level:
  [] / no alerts                                  → 1
  avoid_all_but_essential_travel_to_parts         → 2
  avoid_all_travel_to_parts                       → 3
  avoid_all_but_essential_travel_to_whole_country → 3
  avoid_all_travel_to_whole_country               → 4

Countries not listed default to 1.
"""

from __future__ import annotations

import logging
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Optional

import requests

from config import LOGS_DIR
from country_aliases import resolve_iso_from_name
from db import (
    get_cursor,
    load_geography_iso_map,
    load_geography_name_map,
    normalize_country_name,
    upsert_indicator,
)

SOURCE = "fcdo"
INDICATOR_CODE = "fcdo_advisory_level"
INDICATOR_NAME = "UK FCDO travel advisory level"
INDEX_URL = "https://www.gov.uk/api/content/foreign-travel-advice"
CONTENT_BASE = "https://www.gov.uk/api/content"
REQUEST_TIMEOUT_SEC = 60
REQUEST_DELAY_SEC = 0.12
USER_AGENT = "OutboundTVI/0.1 (research; contact=outbound)"

ALERT_LEVEL: dict[str, int] = {
    "avoid_all_but_essential_travel_to_parts": 2,
    "avoid_all_travel_to_parts": 3,
    "avoid_all_but_essential_travel_to_whole_country": 3,
    "avoid_all_travel_to_whole_country": 4,
}

FCDO_NAME_TO_ISO: dict[str, str] = {
    "brunei": "BRN",
    "burma": "MMR",
    "myanmar burma": "MMR",
    "congo": "COG",
    "democratic republic of the congo": "COD",
    "south korea": "KOR",
    "north korea": "PRK",
    "czech republic": "CZE",
    "the occupied palestinian territories": "PSE",
    "occupied palestinian territories": "PSE",
    "st helena ascension and tristan da cunha": "SHN",
    "st lucia": "LCA",
    "st kitts and nevis": "KNA",
    "st vincent and the grenadines": "VCT",
    "sao tome and principe": "STP",
    "east timor": "TLS",
    "timor leste": "TLS",
    "south sudan": "SSD",
    "ivory coast": "CIV",
    "cote d ivoire": "CIV",
    "gambia": "GMB",
    "the gambia": "GMB",
    "vatican city": "VAT",
    "hong kong": "HKG",
    "macao": "MAC",
    "taiwan": "TWN",
    "british antarctic territory": "ATA",
    "falkland islands": "FLK",
    "western sahara": "ESH",
}


def configure_logging() -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOGS_DIR / "ingest_fcdo.log", encoding="utf-8"),
        ],
    )


logger = logging.getLogger("ingest_fcdo")


def alert_status_to_level(alert_status: Any) -> int:
    if not alert_status:
        return 1
    if isinstance(alert_status, str):
        alert_status = [alert_status]
    if not isinstance(alert_status, list):
        return 1
    level = 1
    for item in alert_status:
        key = str(item or "").strip().lower()
        level = max(level, ALERT_LEVEL.get(key, 1))
    return level


def country_name_from_page(page: dict) -> Optional[str]:
    details = page.get("details") or {}
    country = details.get("country") or {}
    name = country.get("name")
    if name:
        return str(name).strip()
    title = str(page.get("title") or "")
    for suffix in (" travel advice", " Travel Advice"):
        if title.endswith(suffix):
            return title[: -len(suffix)].strip()
    return title.strip() or None


def resolve_geography_id(
    name: str,
    iso_map: dict[str, str],
    name_map: dict[str, str],
) -> Optional[str]:
    norm = normalize_country_name(name)
    if norm in FCDO_NAME_TO_ISO:
        iso = FCDO_NAME_TO_ISO[norm]
        return iso_map.get(iso)
    iso = resolve_iso_from_name(name, normalize_country_name)
    if iso and iso in iso_map:
        return iso_map[iso]
    if norm in name_map:
        return name_map[norm]
    if norm.startswith("the ") and norm[4:] in name_map:
        return name_map[norm[4:]]
    return None


def fetch_json(url: str, session: requests.Session) -> dict:
    resp = session.get(url, timeout=REQUEST_TIMEOUT_SEC)
    resp.raise_for_status()
    return resp.json()


def ingest() -> None:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})

    logger.info("Fetching FCDO index %s", INDEX_URL)
    index = fetch_json(INDEX_URL, session)
    children = (index.get("links") or {}).get("children") or []
    logger.info("FCDO index children=%s", len(children))
    year = datetime.now(timezone.utc).year

    with get_cursor() as cursor:
        iso_map = load_geography_iso_map(cursor)
        name_map = load_geography_name_map(cursor)

        geo_levels: dict[str, int] = {}
        matched_count = 0
        unmatched_count = 0
        unmatched_names: list[str] = []
        fetch_errors = 0
        advisory_from_fcdo: Counter[int] = Counter()

        for i, child in enumerate(children):
            base_path = child.get("base_path") or ""
            if not base_path:
                continue
            url = CONTENT_BASE + str(base_path)
            try:
                page = fetch_json(url, session)
            except Exception as exc:
                fetch_errors += 1
                logger.warning("FCDO fetch failed %s: %s", url, exc)
                time.sleep(REQUEST_DELAY_SEC)
                continue

            name = country_name_from_page(page) or ""
            level = alert_status_to_level((page.get("details") or {}).get("alert_status"))
            advisory_from_fcdo[level] += 1

            geo_id = resolve_geography_id(name, iso_map, name_map) if name else None
            if not geo_id:
                unmatched_count += 1
                unmatched_names.append(name or str(base_path))
                logger.warning(
                    "FCDO unmatched country=%r path=%s level=%s",
                    name,
                    base_path,
                    level,
                )
            else:
                prev = geo_levels.get(geo_id)
                geo_levels[geo_id] = max(prev or 1, level)
                matched_count += 1

            if (i + 1) % 50 == 0:
                logger.info("FCDO progress %s/%s", i + 1, len(children))
            time.sleep(REQUEST_DELAY_SEC)

        stored = 0
        defaults = 0
        for _iso, geography_id in iso_map.items():
            level = geo_levels.get(geography_id, 1)
            if geography_id not in geo_levels:
                defaults += 1
            upsert_indicator(
                cursor,
                geography_id=geography_id,
                source=SOURCE,
                indicator_code=INDICATOR_CODE,
                indicator_name=INDICATOR_NAME,
                value=float(level),
                unit="level_1_to_4",
                year=year,
                data_url=INDEX_URL,
            )
            stored += 1

        final_dist: Counter[int] = Counter()
        for geography_id in iso_map.values():
            final_dist[geo_levels.get(geography_id, 1)] += 1

        logger.info(
            "FCDO matched=%s unmatched=%s fetch_errors=%s stored=%s defaults=%s",
            matched_count,
            unmatched_count,
            fetch_errors,
            stored,
            defaults,
        )
        logger.info(
            "FCDO advisory levels from API pages: %s",
            dict(sorted(advisory_from_fcdo.items())),
        )
        logger.info(
            "FCDO final stored level distribution: %s",
            dict(sorted(final_dist.items())),
        )
        if unmatched_names:
            logger.info("FCDO unmatched sample: %s", unmatched_names[:25])
        logger.info("ingest_fcdo completed successfully")


def main() -> None:
    configure_logging()
    try:
        ingest()
    except Exception:
        logger.exception("ingest_fcdo failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
