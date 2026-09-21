"""
TVI Scoring Configuration
========================
Edit this file to add/remove indicators, change weights, or adjust normalization.
The scoring engine reads this config — it does not hardcode indicator mappings.

Dimension keys match TVIScore.dimensions in packages/core/src/index.ts.
Source names must match raw_indicators.source values from the ingestion workers.

Phase 1 Step 3: travel-intelligence dimensions (Outbound).
"""

DIMENSIONS = {
    "tourismInfrastructure": {
        "label": "Tourism Infrastructure & Capacity",
        "indicators": [
            {
                "source": "world_bank",
                "code": "ST.INT.ARVL",
                "name": "International tourism, number of arrivals",
                "weight": 0.35,
                "direction": "higher_is_better",
                "normalization": "log_scale",
            },
            {
                "source": "world_bank",
                "code": "IS.AIR.DPRT",
                "name": "Air transport, registered carrier departures worldwide",
                "weight": 0.25,
                "direction": "higher_is_better",
                "normalization": "log_scale",
            },
            {
                "source": "world_bank",
                "code": "ST.INT.TVLX.CD",
                "name": "International tourism, expenditures (current US$)",
                "weight": 0.25,
                "direction": "higher_is_better",
                "normalization": "log_scale",
            },
            {
                "source": "world_bank_derived",
                "code": "tourism_receipts_per_arrival",
                "name": "Tourism receipts per arrival",
                "weight": 0.15,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
        ],
    },
    "accessibility": {
        "label": "Accessibility & Ease of Travel",
        "indicators": [
            {
                "source": "ef_epi",
                "code": "ef_epi_score",
                "name": "Environmental Performance Index score",
                "weight": 0.30,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "visa_index",
                "code": "visa_free_score",
                "name": "Visa-free access score",
                "weight": 0.30,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "IT.NET.USER.ZS",
                "name": "Internet users (% of population)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "IT.CEL.SETS.P2",
                "name": "Mobile cellular subscriptions (per 100 people)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
        ],
    },
    "costIndex": {
        "label": "Cost Index",
        "indicators": [
            {
                "source": "world_bank_derived",
                "code": "gdp_ppp_per_capita",
                "name": "GDP PPP per capita",
                "weight": 0.30,
                "direction": "lower_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "FP.CPI.TOTL",
                "name": "Consumer price index (2010 = 100)",
                "weight": 0.30,
                "direction": "lower_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank_derived",
                "code": "tourism_receipts_per_arrival",
                "name": "Tourism receipts per arrival",
                "weight": 0.20,
                "direction": "lower_is_better",
                "normalization": "linear",
            },
            {
                "source": "ecb_fx_derived",
                "code": "fx_volatility",
                "name": "FX volatility (USD cross)",
                "weight": 0.20,
                "direction": "lower_is_better",
                "normalization": "linear",
            },
        ],
    },
    "safetyAndEntry": {
        "label": "Entry Requirements & Safety",
        "indicators": [
            {
                "source": "state_dept_advisory",
                "code": "travel_advisory_level",
                "name": "US State Department travel advisory level",
                "weight": 0.30,
                "direction": "lower_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "RL.PER.RNK",
                "name": "Rule of Law (WGI Percentile)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "transparency",
                "code": "CC.PER.RNK",
                "name": "Control of Corruption (WGI score)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "PV.PER.RNK",
                "name": "Political Stability / Absence of Violence (WGI Percentile)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "visa_index",
                "code": "visa_free_score",
                "name": "Visa-free access score",
                "weight": 0.10,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
        ],
    },
    "travelInfrastructure": {
        "label": "Travel Infrastructure",
        "indicators": [
            {
                "source": "world_bank",
                "code": "EG.ELC.ACCS.ZS",
                "name": "Access to electricity (% of population)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "IT.NET.USER.ZS",
                "name": "Internet users (% of population)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "IT.NET.BBND.P2",
                "name": "Fixed broadband subscriptions (per 100 people)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "LP.LPI.OVRL.XQ",
                "name": "Logistics Performance Index",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank",
                "code": "SH.MED.PHYS.ZS",
                "name": "Physicians (per 1,000 people)",
                "weight": 0.20,
                "direction": "higher_is_better",
                "normalization": "linear",
            },
        ],
    },
    "crowding": {
        "label": "Tourism Crowding",
        "indicators": [
            {
                "source": "world_bank_derived",
                "code": "tourist_arrivals_per_capita",
                "name": "Tourist arrivals per capita",
                "weight": 0.55,
                "direction": "lower_is_better",
                "normalization": "linear",
            },
            {
                "source": "world_bank_derived",
                "code": "tourism_receipts_per_capita",
                "name": "Tourism receipts per capita",
                "weight": 0.45,
                "direction": "lower_is_better",
                "normalization": "linear",
            },
        ],
    },
    # Composite momentum dimension — no raw indicators; derived from trend_scores
    # in compute_tvi.py after the six base dimensions are scored.
    "trajectory": {
        "label": "Trajectory",
        "description": (
            "Composite momentum score derived from trend direction and rate "
            "across all other dimensions"
        ),
        "weight": 1.0,
        "indicators": [],
        "is_composite": True,
    },
}

# Base (non-composite) dimension keys used for indicator scoring and trend→trajectory.
BASE_DIMENSION_KEYS = [
    key for key, cfg in DIMENSIONS.items() if not cfg.get("is_composite")
]


def _with_trajectory(weights: dict[str, float], trajectory_mult: float) -> dict[str, float]:
    """
    Preserve relative weights among the original six dimensions, then add
    trajectory at (average_base_weight * trajectory_mult).
    Engine normalizes by total weight at score time.
    """
    out = dict(weights)
    avg = sum(weights.values()) / len(weights)
    out["trajectory"] = round(avg * trajectory_mult, 3)
    return out


# Industry vertical weight profiles (API applies these on query; compute_tvi stores equal-weight).
# COUPLING: keep in sync with server/api/src/config/tvi.ts INDUSTRY_VERTICALS.
# Trajectory multipliers: tech_saas/telecom 1.3, manufacturing/energy 0.7, else 1.0.
# Profile key renaming is Phase 1 Step 4 — keep GEXIS-era vertical keys for now.
INDUSTRY_VERTICALS = {
    "all": {
        "label": "All Industries",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.167,
                "accessibility": 0.167,
                "costIndex": 0.167,
                "safetyAndEntry": 0.167,
                "travelInfrastructure": 0.167,
                "crowding": 0.167,
            },
            1.0,
        ),
    },
    "tech_saas": {
        "label": "Technology & SaaS",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.15,
                "accessibility": 0.25,
                "costIndex": 0.15,
                "safetyAndEntry": 0.10,
                "travelInfrastructure": 0.20,
                "crowding": 0.15,
            },
            1.3,
        ),
    },
    "financial": {
        "label": "Financial Services",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.20,
                "accessibility": 0.15,
                "costIndex": 0.20,
                "safetyAndEntry": 0.25,
                "travelInfrastructure": 0.10,
                "crowding": 0.10,
            },
            1.0,
        ),
    },
    "manufacturing": {
        "label": "Manufacturing",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.15,
                "accessibility": 0.10,
                "costIndex": 0.15,
                "safetyAndEntry": 0.20,
                "travelInfrastructure": 0.25,
                "crowding": 0.15,
            },
            0.7,
        ),
    },
    "healthcare": {
        "label": "Healthcare & Life Sciences",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.20,
                "accessibility": 0.20,
                "costIndex": 0.10,
                "safetyAndEntry": 0.25,
                "travelInfrastructure": 0.15,
                "crowding": 0.10,
            },
            1.0,
        ),
    },
    "ecommerce": {
        "label": "E-Commerce & Retail",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.25,
                "accessibility": 0.10,
                "costIndex": 0.15,
                "safetyAndEntry": 0.10,
                "travelInfrastructure": 0.25,
                "crowding": 0.15,
            },
            1.0,
        ),
    },
    "energy": {
        "label": "Energy & Renewables",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.15,
                "accessibility": 0.10,
                "costIndex": 0.15,
                "safetyAndEntry": 0.25,
                "travelInfrastructure": 0.25,
                "crowding": 0.10,
            },
            0.7,
        ),
    },
    "professional": {
        "label": "Professional Services",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.15,
                "accessibility": 0.30,
                "costIndex": 0.15,
                "safetyAndEntry": 0.15,
                "travelInfrastructure": 0.10,
                "crowding": 0.15,
            },
            1.0,
        ),
    },
    "logistics": {
        "label": "Logistics & Supply Chain",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.20,
                "accessibility": 0.05,
                "costIndex": 0.15,
                "safetyAndEntry": 0.15,
                "travelInfrastructure": 0.35,
                "crowding": 0.10,
            },
            1.0,
        ),
    },
    "telecom": {
        "label": "Telecommunications",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.20,
                "accessibility": 0.15,
                "costIndex": 0.10,
                "safetyAndEntry": 0.20,
                "travelInfrastructure": 0.25,
                "crowding": 0.10,
            },
            1.3,
        ),
    },
    "consumer_goods": {
        "label": "Consumer Goods & CPG",
        "weights": _with_trajectory(
            {
                "tourismInfrastructure": 0.25,
                "accessibility": 0.10,
                "costIndex": 0.10,
                "safetyAndEntry": 0.15,
                "travelInfrastructure": 0.20,
                "crowding": 0.20,
            },
            1.0,
        ),
    },
}

# Legacy equal-weight map used by compute_tvi batch (DB industry_vertical key).
VERTICAL_WEIGHTS = {
    "all_industries": INDUSTRY_VERTICALS["all"]["weights"],
}

INDUSTRY_VERTICAL = "all_industries"
MIN_DIMENSIONS_FOR_OVERALL = 3
