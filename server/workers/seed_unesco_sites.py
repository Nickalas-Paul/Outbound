"""
Seed UNESCO World Heritage site counts into raw_indicators.

Static data: server/workers/data/unesco_sites.json
Writes source=unesco, indicator_code=unesco_site_count.

Countries with no UNESCO sites get value 0 (valid data, not missing).
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from config import LOGS_DIR
from db import get_cursor, load_geography_iso_map, upsert_indicator

SOURCE = "unesco"
INDICATOR_CODE = "unesco_site_count"
INDICATOR_NAME = "UNESCO World Heritage site count"
DATA_PATH = Path(__file__).resolve().parent / "data" / "unesco_sites.json"
DATA_URL = "https://whc.unesco.org/en/list/"
YEAR = 2024


def configure_logging() -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOGS_DIR / "seed_unesco_sites.log", encoding="utf-8"),
        ],
    )


logger = logging.getLogger("seed_unesco_sites")


def load_seed() -> list[dict]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Missing seed file: {DATA_PATH}")
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("unesco_sites.json must be a JSON array")
    return raw


def seed() -> None:
    rows = load_seed()
    logger.info("Loaded %s UNESCO seed rows from %s", len(rows), DATA_PATH.name)

    by_iso: dict[str, int] = {}
    for row in rows:
        iso = str(row.get("country_iso3") or "").strip().upper()
        if not iso:
            continue
        try:
            by_iso[iso] = int(row["total_sites"])
        except (KeyError, TypeError, ValueError):
            logger.warning("Bad UNESCO row: %s", row)
            continue

    stored = 0
    skipped_geo = 0
    unmatched: list[str] = []
    zero_filled = 0

    with get_cursor() as cursor:
        iso_map = load_geography_iso_map(cursor)
        for iso, geography_id in iso_map.items():
            if iso in by_iso:
                value = float(by_iso[iso])
            else:
                value = 0.0
                zero_filled += 1
            upsert_indicator(
                cursor,
                geography_id=geography_id,
                source=SOURCE,
                indicator_code=INDICATOR_CODE,
                indicator_name=INDICATOR_NAME,
                value=value,
                unit="count",
                year=YEAR,
                data_url=DATA_URL,
            )
            stored += 1

        for iso in by_iso:
            if iso not in iso_map:
                skipped_geo += 1
                unmatched.append(iso)
                logger.warning("No geography for UNESCO iso=%s — skipping", iso)

    logger.info(
        "Done stored=%s zero_filled=%s skipped_geo=%s unmatched=%s",
        stored,
        zero_filled,
        skipped_geo,
        unmatched[:30],
    )
    logger.info("seed_unesco_sites completed successfully")


def main() -> None:
    configure_logging()
    try:
        seed()
    except Exception:
        logger.exception("seed_unesco_sites failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
