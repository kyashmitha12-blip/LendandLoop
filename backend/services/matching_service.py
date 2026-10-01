import re

from backend.models import Resource


def _extract_price_value(price_str: str) -> int:
    """Extract the first integer from a price string like '₹150/day' or 'Free'."""
    if not price_str:
        return 0
    digits = re.findall(r"\d+", price_str)
    return int(digits[0]) if digits else 0


def calculate_match_score(resource: Resource) -> int:
    """Score a resource 1-99 based on availability, condition, distance, price, duration and reliability."""
    availability = 12 if resource.status == "available" else 0
    condition_score = 12 if resource.condition == "Excellent" else 8 if resource.condition == "Good" else 3
    distance_km = float(resource.distance_km or 1.0)
    distance_score = 8 if distance_km <= 1 else 6 if distance_km <= 1.5 else 3 if distance_km <= 3 else 0
    price_value = _extract_price_value(resource.price_per_day or "")
    if price_value == 0:
        price_score = 8  # Free resources get max price score
    elif price_value <= 60:
        price_score = 8
    elif price_value <= 120:
        price_score = 6
    elif price_value <= 150:
        price_score = 4
    else:
        price_score = 1
    duration_score = 3 if (resource.duration_days or 1) <= 3 else -2
    reliability_score = float(getattr(resource, "reliability", 85)) * 0.1
    score = 50 + availability + condition_score + distance_score + price_score + duration_score + reliability_score
    return min(99, max(1, round(score)))
