from backend.services.idle_resource_service import find_idle_resources
from backend.services.prediction_service import build_prediction_snapshot


RESOURCE_TERMS = {
    "projector": ("projector",),
    "dslr": ("dslr", "camera"),
    "arduino": ("arduino",),
    "microphone": ("microphone", "mic"),
    "tripod": ("tripod",),
}


def _matches_prediction(resource, category):
    terms = RESOURCE_TERMS.get(category, (category,))
    resource_text = f"{resource.name} {resource.description or ''}".casefold()
    words = set(resource_text.replace("-", " ").split())
    return any(term.casefold() in words for term in terms)


def suggest_activations():
    suggestions = []
    for prediction in build_prediction_snapshot():
        if prediction["supply_gap"] <= 0:
            continue
        for resource in find_idle_resources():
            category = prediction["resource_category"]
            if resource.category in ["equip", "space"] and _matches_prediction(resource, category):
                suggestions.append({
                    "resource_id": resource.id,
                    "name": resource.name,
                    "category": resource.category,
                    "predicted_gap": prediction["supply_gap"],
                    "message": f"{prediction['predicted_demand']} demand predicted for {category} with a {prediction['supply_gap']} gap.",
                })
    return suggestions
