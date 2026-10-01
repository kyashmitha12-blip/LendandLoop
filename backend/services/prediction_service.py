"""
Prediction Service
------------------
Combines the ML demand_prediction module (synthetic moving-average model)
with real database supply counts to produce meaningful supply-gap data.
Clearly labelled as a prototype using synthetic training data.
"""
from backend.ml.demand_prediction import predict_demand
from backend.models import Resource


# Map of prediction category keys → keywords that appear in resource names/descriptions
CATEGORY_KEYWORDS = {
    "projector":   ["projector", "epson", "benq", "viewsonic"],
    "dslr":        ["dslr", "camera", "canon", "nikon", "sony"],
    "arduino":     ["arduino", "microcontroller", "raspberry"],
    "microphone":  ["microphone", "mic", "condenser"],
    "tripod":      ["tripod", "monopod"],
    "speaker":     ["speaker", "bluetooth speaker"],
    "laptop":      ["laptop", "notebook", "macbook"],
    "study_room":  ["study pod", "study room", "silent room"],
}

# Friendly display names for each category
CATEGORY_DISPLAY = {
    "projector":  "Projector",
    "dslr":       "DSLR Camera",
    "arduino":    "Arduino Kit",
    "microphone": "Microphone",
    "tripod":     "Tripod",
    "speaker":    "Speaker",
    "laptop":     "Laptop",
    "study_room": "Study Room",
}


def _count_supply(category: str) -> int:
    """Count available resources in DB that match the given category."""
    keywords = CATEGORY_KEYWORDS.get(category, [category])
    all_resources = Resource.query.filter(
        Resource.status.in_(["available", "idle"])
    ).all()
    count = 0
    for resource in all_resources:
        text = f"{resource.name} {resource.description or ''}".lower()
        if any(kw in text for kw in keywords):
            count += 1
    return count


def build_prediction_snapshot() -> list:
    """
    Return a list of prediction dicts for each tracked resource category.
    Uses ML model (synthetic moving-average) for demand, real DB for supply.
    Clearly marked as prototype predictions.
    """
    results = []
    for category, display_name in CATEGORY_DISPLAY.items():
        predicted = predict_demand(category)
        supply = _count_supply(category)
        gap = max(0, predicted - supply)
        if gap >= 5:
            level = "high"
        elif gap > 0:
            level = "medium"
        else:
            level = "low"
        results.append({
            "resource_category": category,
            "display_name": display_name,
            "predicted_demand": predicted,
            "current_supply": supply,
            "supply_gap": gap,
            "demand_level": level,
            "prediction_period": "Next 7 days",
            "note": "Prototype prediction using synthetic historical data",
        })
    return results


def predict_demand_for_category(category: str) -> dict:
    """Return prediction snapshot for a single category."""
    snapshot = build_prediction_snapshot()
    for row in snapshot:
        if row["resource_category"] == category:
            return row
    return {
        "resource_category": category,
        "display_name": category.title(),
        "predicted_demand": 5,
        "current_supply": _count_supply(category),
        "supply_gap": 0,
        "demand_level": "low",
        "prediction_period": "Next 7 days",
        "note": "Prototype prediction using synthetic historical data",
    }
