"""
demand_prediction.py
--------------------
Prototype ML demand forecaster for campus resource categories.

Method: Weighted Moving Average + Linear Trend Extrapolation
  - Uses 7-week synthetic historical demand data per category.
  - Recent weeks are weighted more heavily (recency bias).
  - A linear trend component (slope) is added to capture growing/falling demand.

This is labelled as a PROTOTYPE using synthetic training data.
Replace `generate_synthetic_history()` with real booking query data
to upgrade to a production model.

Production upgrade path:
  1. Query booking history by category and week from the DB.
  2. Optionally swap WMA for scikit-learn LinearRegression or
     a statsmodels ARIMA model for time-series forecasting.
"""

from datetime import datetime


# ------------------------------------------------------------------
# Synthetic historical demand data
# Format: {category: [week-1 demand, week-2, ..., week-7]}
# Week-7 is the most recent week.
# Replace with real DB data for production use.
# ------------------------------------------------------------------
SYNTHETIC_HISTORY = {
    "projector":   [8, 10, 12, 9, 11, 14, 12],
    "dslr":        [6,  7,  8, 9,  7,  8, 10],
    "arduino":     [10, 13, 15, 12, 16, 18, 15],
    "microphone":  [5,  6,  9,  8,  7, 10,  9],
    "tripod":      [4,  5,  7,  6,  8,  7,  8],
    "speaker":     [3,  4,  5,  4,  6,  7,  6],
    "laptop":      [12, 14, 16, 15, 17, 18, 20],
    "study_room":  [7,  8, 10, 11, 12, 13, 14],
}

# Weights for WMA — most recent week has highest weight
WMA_WEIGHTS = [1, 1, 2, 2, 3, 3, 4]


def generate_synthetic_history() -> dict:
    """Return synthetic weekly booking history per category."""
    return SYNTHETIC_HISTORY.copy()


def _weighted_moving_average(history: list, weights: list) -> float:
    """Compute a weighted moving average of the history array."""
    if not history or not weights:
        return 0.0
    n = min(len(history), len(weights))
    h = history[-n:]
    w = weights[-n:]
    total_weight = sum(w)
    if total_weight == 0:
        return sum(h) / len(h)
    return sum(val * wt for val, wt in zip(h, w)) / total_weight


def _linear_trend(history: list) -> float:
    """
    Compute a simple linear trend slope from the history.
    Uses least-squares formula: slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
    """
    n = len(history)
    if n < 2:
        return 0.0
    x = list(range(n))
    sum_x = sum(x)
    sum_y = sum(history)
    sum_xy = sum(xi * yi for xi, yi in zip(x, history))
    sum_x2 = sum(xi ** 2 for xi in x)
    denom = n * sum_x2 - sum_x ** 2
    if denom == 0:
        return 0.0
    return (n * sum_xy - sum_x * sum_y) / denom


def predict_demand(category: str) -> int:
    """
    Predict next-week demand for a resource category.

    Returns an integer booking count prediction.
    Uses weighted moving average + linear trend from synthetic historical data.
    """
    history_map = generate_synthetic_history()
    history = history_map.get(category, [5, 6, 7, 8, 7, 8, 9])

    wma = _weighted_moving_average(history, WMA_WEIGHTS)
    trend = _linear_trend(history)

    # Forecast = WMA + 1-step trend extrapolation
    # Cap trend contribution to avoid wild extrapolation on short histories
    trend_contribution = max(-3.0, min(3.0, trend))
    forecast = wma + trend_contribution

    # Apply a small seasonal boost for months when demand typically peaks
    # (hackathon months: Oct-Nov and Mar-Apr in Indian academic calendar)
    current_month = datetime.utcnow().month
    seasonal_boost = 1.0
    if current_month in (3, 4, 10, 11):
        seasonal_boost = 1.15  # 15% higher demand during exam/project seasons

    return max(1, round(forecast * seasonal_boost))
