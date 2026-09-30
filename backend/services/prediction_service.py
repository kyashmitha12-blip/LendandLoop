from backend.models import Prediction, Resource


def build_prediction_snapshot():
    categories = [
        {"resource_category": "projector", "predicted_demand": 12, "current_supply": 5},
        {"resource_category": "dslr", "predicted_demand": 8, "current_supply": 6},
        {"resource_category": "arduino", "predicted_demand": 15, "current_supply": 10},
        {"resource_category": "microphone", "predicted_demand": 9, "current_supply": 4},
        {"resource_category": "tripod", "predicted_demand": 7, "current_supply": 3},
    ]
    output = []
    for item in categories:
        gap = max(0, item["predicted_demand"] - item["current_supply"])
        level = "high" if gap >= 5 else "medium" if gap > 0 else "low"
        output.append({
            "resource_category": item["resource_category"],
            "predicted_demand": item["predicted_demand"],
            "current_supply": item["current_supply"],
            "supply_gap": gap,
            "demand_level": level,
            "prediction_period": "Next 7 days",
        })
    return output


def predict_demand_for_category(category):
    snapshot = build_prediction_snapshot()
    for row in snapshot:
        if row["resource_category"] == category:
            return row
    return {"resource_category": category, "predicted_demand": 5, "current_supply": 5, "supply_gap": 0, "demand_level": "low", "prediction_period": "Next 7 days"}
