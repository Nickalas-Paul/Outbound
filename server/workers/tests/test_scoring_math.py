"""
Golden-fixture tests for TVI scoring math.

Synthetic inputs only — no database, network, or real data sources.
Protects normalization, weighting, missing-data handling, confidence,
and trend→trajectory conversion before Phase 1 config swaps.
"""

from __future__ import annotations

import math

from compute_tvi import (
    compute_confidence,
    compute_overall_score,
    min_max_normalize,
    rate_to_trend_score,
    round_score,
    transform_for_norm,
    weighted_average,
)
from scoring_config import MIN_DIMENSIONS_FOR_OVERALL


def _parts(
    values: list[float | None],
    weights: list[float],
) -> list[tuple[float, float]]:
    """Build (score, weight) pairs the same way compute_tvi filters missing data."""
    return [(v, w) for v, w in zip(values, weights) if v is not None]


def _geo_map(values: list[float]) -> dict[str, float]:
    return {f"g{i}": v for i, v in enumerate(values)}


# ---------------------------------------------------------------------------
# weighted_average
# ---------------------------------------------------------------------------


def test_weighted_average_full_data():
    result = weighted_average(_parts([80, 60, 40], [0.5, 0.3, 0.2]))
    assert result == 66.0


def test_weighted_average_partial_data_missing_indicator():
    values = [80, None, 40]
    weights = [0.5, 0.3, 0.2]
    parts = _parts(values, weights)

    assert parts == [(80, 0.5), (40, 0.2)]
    included_weight = sum(w for _, w in parts)
    assert abs(included_weight - 0.7) < 1e-12

    result = weighted_average(parts)
    expected = 80 * (0.5 / 0.7) + 40 * (0.2 / 0.7)
    assert result is not None
    assert abs(result - expected) < 1e-9
    assert abs(result - (480 / 7)) < 1e-9  # ≈ 68.571428...

    # Renormalized weights among available parts sum to 1.0
    renorm = [w / included_weight for _, w in parts]
    assert abs(sum(renorm) - 1.0) < 1e-12


def test_weighted_average_all_missing():
    result = weighted_average(_parts([None, None, None], [0.5, 0.3, 0.2]))
    assert result is None


# ---------------------------------------------------------------------------
# Linear min-max normalization
# ---------------------------------------------------------------------------


def test_linear_minmax_higher_is_better():
    normalized = min_max_normalize(
        _geo_map([10, 30, 50, 70, 90]),
        "higher_is_better",
    )
    assert [normalized[f"g{i}"] for i in range(5)] == [0.0, 25.0, 50.0, 75.0, 100.0]


def test_linear_minmax_lower_is_better_inverted():
    normalized = min_max_normalize(
        _geo_map([10, 30, 50, 70, 90]),
        "lower_is_better",
    )
    assert [normalized[f"g{i}"] for i in range(5)] == [100.0, 75.0, 50.0, 25.0, 0.0]


def test_linear_minmax_flat_range():
    normalized = min_max_normalize(_geo_map([50, 50, 50]), "higher_is_better")
    assert list(normalized.values()) == [50.0, 50.0, 50.0]


def test_linear_minmax_single_value():
    normalized = min_max_normalize(_geo_map([42]), "higher_is_better")
    assert list(normalized.values()) == [50.0]


# ---------------------------------------------------------------------------
# Log normalization
# ---------------------------------------------------------------------------


def test_log_normalization_higher_is_better():
    raw = [1, 10, 100, 1000, 10000]
    transformed: dict[str, float] = {}
    for i, value in enumerate(raw):
        tval = transform_for_norm(value, "log_scale")
        assert tval is not None
        transformed[f"g{i}"] = tval

    assert [transformed[f"g{i}"] for i in range(5)] == [0.0, 1.0, 2.0, 3.0, 4.0]

    normalized = min_max_normalize(transformed, "higher_is_better")
    assert [normalized[f"g{i}"] for i in range(5)] == [0.0, 25.0, 50.0, 75.0, 100.0]


def test_log_normalization_non_positive_skipped():
    raw = [0, 10, 100]
    transformed: dict[str, float] = {}
    for i, value in enumerate(raw):
        tval = transform_for_norm(value, "log_scale")
        if tval is None:
            continue
        transformed[f"g{i}"] = tval

    # 0 is excluded; remaining log10([10, 100]) → [1, 2]
    assert set(transformed.keys()) == {"g1", "g2"}
    assert transformed["g1"] == 1.0
    assert transformed["g2"] == 2.0

    normalized = min_max_normalize(transformed, "higher_is_better")
    assert normalized["g1"] == 0.0
    assert normalized["g2"] == 100.0


# ---------------------------------------------------------------------------
# Overall score aggregation
# ---------------------------------------------------------------------------

_EQUAL_WEIGHTS = {
    "marketSizeAndGrowth": 0.167,
    "talentDensity": 0.167,
    "taxEnvironment": 0.167,
    "regulatoryEase": 0.167,
    "infrastructure": 0.167,
    "competitorSaturation": 0.167,
    "trajectory": 0.167,
}


def test_overall_score_with_missing_dimensions():
    # 7 dimensions, 2 null → 5 scored (≥ MIN_DIMENSIONS_FOR_OVERALL of 3)
    dimensions = {
        "marketSizeAndGrowth": 80,
        "talentDensity": 60,
        "taxEnvironment": 70,
        "regulatoryEase": 90,
        "infrastructure": 50,
        "competitorSaturation": None,
        "trajectory": None,
    }
    assert MIN_DIMENSIONS_FOR_OVERALL == 3

    overall = compute_overall_score(dimensions, _EQUAL_WEIGHTS)
    # Equal weights among 5 non-null → arithmetic mean, then round_score
    expected_raw = (80 + 60 + 70 + 90 + 50) / 5  # 70.0
    assert overall == round_score(expected_raw)
    assert overall == 70
    assert overall is not None


def test_overall_score_below_minimum_dimension_threshold():
    # Only 2 scored (< MIN_DIMENSIONS_FOR_OVERALL)
    dimensions = {
        "marketSizeAndGrowth": 80,
        "talentDensity": 60,
        "taxEnvironment": None,
        "regulatoryEase": None,
        "infrastructure": None,
        "competitorSaturation": None,
        "trajectory": None,
    }
    overall = compute_overall_score(dimensions, _EQUAL_WEIGHTS)
    assert overall is None


# ---------------------------------------------------------------------------
# Confidence classification
# ---------------------------------------------------------------------------


def test_confidence_high():
    assert (
        compute_confidence(
            dimensions_scored=6,
            indicators_present=65,
            indicators_total=100,
        )
        == "high"
    )


def test_confidence_medium_by_dimension_count():
    # ≥4 dims, coverage < 60% → medium via dimension count
    assert (
        compute_confidence(
            dimensions_scored=4,
            indicators_present=25,
            indicators_total=100,
        )
        == "medium"
    )


def test_confidence_medium_by_coverage():
    # <4 dims but coverage ≥ 30% → medium via coverage
    assert (
        compute_confidence(
            dimensions_scored=3,
            indicators_present=35,
            indicators_total=100,
        )
        == "medium"
    )


def test_confidence_low():
    assert (
        compute_confidence(
            dimensions_scored=2,
            indicators_present=20,
            indicators_total=100,
        )
        == "low"
    )


# ---------------------------------------------------------------------------
# rate_to_trend_score
# ---------------------------------------------------------------------------


def test_rate_to_trend_score_positive():
    raw = rate_to_trend_score(2.0)
    expected = 50.0 + 40.0 * math.tanh(1.0)
    assert abs(raw - expected) < 1e-9
    assert abs(raw - 80.4637662382306) < 1e-9
    assert round_score(raw) == 80


def test_rate_to_trend_score_zero():
    raw = rate_to_trend_score(0.0)
    assert raw == 50.0
    assert round_score(raw) == 50


def test_rate_to_trend_score_strong_negative():
    raw = rate_to_trend_score(-4.0)
    expected = 50.0 + 40.0 * math.tanh(-2.0)
    assert abs(raw - expected) < 1e-9
    assert abs(raw - 11.438896796967324) < 1e-9
    assert round_score(raw) == 11
