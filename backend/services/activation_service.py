from backend.models import Notification, Resource
from backend.services.idle_resource_service import find_idle_resources
from backend.services.prediction_service import build_prediction_snapshot


def suggest_activations():
    suggestions = []
    for prediction in build_prediction_snapshot():
        if prediction["supply_gap"] <= 0:
            continue
        for resource in find_idle_resources():
            if resource.category in ["equip", "space"]:
                suggestions.append({
                    "resource_id": resource.id,
                    "name": resource.name,
                    "category": resource.category,
                    "predicted_gap": prediction["supply_gap"],
                    "message": f"{prediction['predicted_demand']} demand predicted for {prediction['resource_category']} with a {prediction['supply_gap']} gap.",
                })
    return suggestions
