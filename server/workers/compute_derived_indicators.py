"""
Compute derived travel indicators and write them to raw_indicators.

Runs AFTER base ingest workers (world_bank, imf, currency rates) and BEFORE
compute_trends / compute_tvi.

Derived codes:
  world_bank_derived / tourism_receipts_per_arrival
  world_bank_derived / tourist_arrivals_per_capita
  world_bank_derived / tourism_receipts_per_capita
  world_bank_derived / gdp_ppp_per_capita   (IMF GDP PPP billions → USD / pop)
  ecb_fx_derived / fx_volatility            (90d std of daily FX returns)

Note: market_signals (source=ecb_fx) only stores volatility *event* flags, not
daily rates. FX volatility is computed from the same Frankfurter/ECB API the
currency worker uses, then written to raw_indicators.
"""

from __future__ import annotations

import logging
import math
import statistics
import sys
from datetime import date, timedelta
from typing import Any, Optional

import requests

from config import LOGS_DIR
from db import get_cursor, load_geography_iso_map, upsert_indicator

REQUEST_TIMEOUT_SEC = 90
FX_WINDOW_DAYS = 90
FX_MIN_POINTS = 30

# Same mapping as ingest_currency.py
CURRENCY_TO_ISO3: dict[str, list[str]] = {
    "EUR": [
        "DEU", "FRA", "ITA", "ESP", "NLD", "BEL", "AUT", "FIN", "IRL", "PRT",
        "GRC", "LUX", "SVK", "SVN", "EST", "LVA", "LTU", "MLT", "CYP",
    ],
    "GBP": ["GBR"],
    "JPY": ["JPN"],
    "CNY": ["CHN"],
    "BRL": ["BRA"],
    "INR": ["IND"],
    "MXN": ["MEX"],
    "KRW": ["KOR"],
    "IDR": ["IDN"],
    "TRY": ["TUR"],
    "ZAR": ["ZAF"],
    "THB": ["THA"],
    "PLN": ["POL"],
    "MYR": ["MYS"],
    "PHP": ["PHL"],
    "SEK": ["SWE"],
    "NOK": ["NOR"],
    "DKK": ["DNK"],
    "CZK": ["CZE"],
    "HUF": ["HUN"],
    "RON": ["ROU"],
    "ILS": ["ISR"],
    "CHF": ["CHE"],
    "SGD": ["SGP"],
    "HKD": ["HKG"],
    "NZD": ["NZL"],
    "AUD": ["AUS"],
    "CAD": ["CAN"],
    "ISK": ["ISL"],
}


def configure_logging() -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(
                LOGS_DIR / "compute_derived_indicators.log", encoding="utf-8"
            ),
        ],
    )


logger = logging.getLogger("compute_derived_indicators")


def _safe_div(numer: Any, denom: Any) -> Optional[float]:
    """Return numer/denom, or None if either is missing/zero/non-finite."""
    try:
        if numer is None or denom is None:
            return None
        n = float(numer)
        d = float(denom)
        if d == 0.0 or math.isnan(n) or math.isnan(d) or math.isinf(n) or math.isinf(d):
            return None
        out = n / d
        if math.isnan(out) or math.isinf(out):
            return None
        return out
    except (TypeError, ValueError):
        return None


def _load_latest_by_geo_year(
    cursor, source: str, code: str
) -> dict[tuple[str, int], float]:
    """Return {(geography_id, year): value} for non-null rows."""
    cursor.execute(
        """
        SELECT geography_id::text, year, value
        FROM raw_indicators
        WHERE source = %s
          AND indicator_code = %s
          AND value IS NOT NULL
        """,
        (source, code),
    )
    out: dict[tuple[str, int], float] = {}
    for geo_id, year, value in cursor.fetchall():
        try:
            out[(geo_id, int(year))] = float(value)
        except (TypeError, ValueError):
            continue
    return out


def _years_union(*maps: dict[tuple[str, int], float]) -> set[tuple[str, int]]:
    keys: set[tuple[str, int]] = set()
    for m in maps:
        keys |= set(m.keys())
    return keys


def compute_world_bank_derived(cursor) -> int:
    arrivals = _load_latest_by_geo_year(cursor, "world_bank", "ST.INT.ARVL")
    receipts = _load_latest_by_geo_year(cursor, "world_bank", "ST.INT.TVLX.CD")
    population = _load_latest_by_geo_year(cursor, "world_bank", "SP.POP.TOTL")
    imf_ppp = _load_latest_by_geo_year(cursor, "imf_weo", "imf_gdp_ppp")

    written = 0

    # tourism_receipts_per_arrival
    for key in _years_union(arrivals, receipts):
        geo_id, year = key
        val = _safe_div(receipts.get(key), arrivals.get(key))
        upsert_indicator(
            cursor,
            geography_id=geo_id,
            source="world_bank_derived",
            indicator_code="tourism_receipts_per_arrival",
            indicator_name="Tourism receipts per arrival",
            value=val,
            unit="USD_per_arrival",
            year=year,
            data_url=None,
        )
        written += 1

    # tourist_arrivals_per_capita
    for key in _years_union(arrivals, population):
        geo_id, year = key
        val = _safe_div(arrivals.get(key), population.get(key))
        upsert_indicator(
            cursor,
            geography_id=geo_id,
            source="world_bank_derived",
            indicator_code="tourist_arrivals_per_capita",
            indicator_name="Tourist arrivals per capita",
            value=val,
            unit="arrivals_per_person",
            year=year,
            data_url=None,
        )
        written += 1

    # tourism_receipts_per_capita
    for key in _years_union(receipts, population):
        geo_id, year = key
        val = _safe_div(receipts.get(key), population.get(key))
        upsert_indicator(
            cursor,
            geography_id=geo_id,
            source="world_bank_derived",
            indicator_code="tourism_receipts_per_capita",
            indicator_name="Tourism receipts per capita",
            value=val,
            unit="USD_per_person",
            year=year,
            data_url=None,
        )
        written += 1

    # gdp_ppp_per_capita — IMF stores billions; convert to absolute before / pop
    for key in _years_union(imf_ppp, population):
        geo_id, year = key
        ppp_billions = imf_ppp.get(key)
        pop = population.get(key)
        if ppp_billions is None:
            val = None
        else:
            val = _safe_div(float(ppp_billions) * 1_000_000_000.0, pop)
        upsert_indicator(
            cursor,
            geography_id=geo_id,
            source="world_bank_derived",
            indicator_code="gdp_ppp_per_capita",
            indicator_name="GDP PPP per capita",
            value=val,
            unit="intl_USD_per_person",
            year=year,
            data_url=None,
        )
        written += 1

    return written


def fetch_fx_history(start: date, end: date) -> dict[str, Any]:
    url = (
        f"https://api.frankfurter.dev/v1/"
        f"{start.isoformat()}..{end.isoformat()}?base=USD"
    )
    response = requests.get(
        url,
        headers={"Accept": "application/json", "User-Agent": "outbound-mvp/1.0"},
        timeout=REQUEST_TIMEOUT_SEC,
    )
    response.raise_for_status()
    return response.json()


def compute_fx_volatility(cursor, iso_map: dict[str, str]) -> int:
    """
    90-day stdev of daily percent changes per currency → write one value
    per mapped country for the current calendar year.
    """
    today = date.today()
    start = today - timedelta(days=FX_WINDOW_DAYS)
    try:
        payload = fetch_fx_history(start, today)
    except Exception:
        logger.exception("Failed fetching Frankfurter FX history")
        return 0

    rates_by_date = payload.get("rates") or {}
    if not isinstance(rates_by_date, dict) or not rates_by_date:
        logger.warning("Frankfurter returned empty rates for FX volatility")
        return 0

    dates = sorted(rates_by_date.keys())
    series: dict[str, list[float]] = {ccy: [] for ccy in CURRENCY_TO_ISO3}
    for d in dates:
        day_rates = rates_by_date.get(d) or {}
        if not isinstance(day_rates, dict):
            continue
        for ccy in CURRENCY_TO_ISO3:
            val = day_rates.get(ccy)
            if val is None:
                continue
            try:
                series[ccy].append(float(val))
            except (TypeError, ValueError):
                continue

    year = today.year
    written = 0
    skipped_sparse = 0
    skipped_geo = 0

    for ccy, values in series.items():
        if len(values) < FX_MIN_POINTS:
            skipped_sparse += 1
            vol: Optional[float] = None
        else:
            # Daily returns
            returns: list[float] = []
            for i in range(1, len(values)):
                prev = values[i - 1]
                if prev == 0:
                    continue
                returns.append((values[i] - prev) / prev)
            if len(returns) < FX_MIN_POINTS - 1:
                skipped_sparse += 1
                vol = None
            else:
                vol = statistics.pstdev(returns)

        for iso3 in CURRENCY_TO_ISO3[ccy]:
            geography_id = iso_map.get(iso3)
            if not geography_id:
                skipped_geo += 1
                continue
            upsert_indicator(
                cursor,
                geography_id=geography_id,
                source="ecb_fx_derived",
                indicator_code="fx_volatility",
                indicator_name="FX volatility (USD cross, 90d)",
                value=vol,
                unit="stdev_daily_return",
                year=year,
                data_url="https://api.frankfurter.dev/",
            )
            written += 1

    logger.info(
        "fx_volatility written=%s skipped_sparse_ccy=%s skipped_geo=%s",
        written,
        skipped_sparse,
        skipped_geo,
    )
    return written


def compute() -> None:
    with get_cursor() as cursor:
        iso_map = load_geography_iso_map(cursor)
        wb_written = compute_world_bank_derived(cursor)
        fx_written = compute_fx_volatility(cursor, iso_map)

    logger.info(
        "Done world_bank_derived_upserts=%s fx_volatility_upserts=%s",
        wb_written,
        fx_written,
    )
    logger.info("compute_derived_indicators completed successfully")


def main() -> None:
    configure_logging()
    try:
        compute()
    except Exception:
        logger.exception("compute_derived_indicators failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
