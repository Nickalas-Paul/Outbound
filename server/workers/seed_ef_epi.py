"""
Seed EF English Proficiency Index scores into raw_indicators.

Static data: server/workers/data/ef_epi_scores.json
Writes source=ef_epi, indicator_code=ef_epi_score.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from config import LOGS_DIR
from db import get_cursor, load_geography_iso_map, upsert_indicator

SOURCE = "ef_epi"
INDICATOR_CODE = "ef_epi_score"
INDICATOR_NAME = "EF English Proficiency Index score"
DATA_PATH = Path(__file__).resolve().parent / "data" / "ef_epi_scores.json"


def configure_logging() -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOGS_DIR / "seed_ef_epi.log", encoding="utf-8"),
        ],
    )


logger = logging.getLogger("seed_ef_epi")


def load_seed() -> list[dict]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Missing seed file: {DATA_PATH}")
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("ef_epi_scores.json must be a JSON array")
    return raw


def seed() -> None:
    rows = load_seed()
    logger.info("Loaded %s EF EPI seed rows from %s", len(rows), DATA_PATH.name)

    stored = 0
    skipped_geo = 0
    skipped_bad = 0
    unmatched: list[str] = []

    with get_cursor() as cursor:
        iso_map = load_geography_iso_map(cursor)
        for row in rows:
            iso = str(row.get("country_iso3") or "").strip().upper()
            if not iso:
                skipped_bad += 1
                continue
            geography_id = iso_map.get(iso)
            if not geography_id:
                skipped_geo += 1
                unmatched.append(iso)
                logger.warning("No geography for EF EPI iso=%s — skipping", iso)
                continue
            try:
                year = int(row["year"])
                score = float(row["score"])
            except (KeyError, TypeError, ValueError):
                skipped_bad += 1
                continue
            upsert_indicator(
                cursor,
                geography_id=geography_id,
                source=SOURCE,
                indicator_code=INDICATOR_CODE,
                indicator_name=INDICATOR_NAME,
                value=score,
                unit="index_score",
                year=year,
                data_url="https://www.ef.com/epi/",
            )
            stored += 1

    logger.info(
        "Done stored=%s skipped_geo=%s skipped_bad=%s unmatched=%s",
        stored,
        skipped_geo,
        skipped_bad,
        unmatched[:20],
    )
    logger.info("seed_ef_epi completed successfully")


def main() -> None:
    configure_logging()
    try:
        seed()
    except Exception:
        logger.exception("seed_ef_epi failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
