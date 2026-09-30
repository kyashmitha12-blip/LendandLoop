from backend.models import Resource


def calculate_match_score(resource: Resource):
    availability = 12 if resource.status == "available" else 0
    condition_score = 12 if resource.condition == "Excellent" else 8 if resource.condition == "Good" else 3
    distance_score = 8 if resource.distance_km <= 1 else 6 if resource.distance_km <= 1.5 else 3 if resource.distance_km <= 3 else 0
    price_score = 8 if (resource.price_per_day or "0").isdigit() and int(resource.price_per_day.replace("₹", "").replace("/day", "")) <= 60 else 6 if resource.price_per_day and "₹" in resource.price_per_day and int(resource.price_per_day.replace("₹", "").replace("/day", "")) <= 120 else 4 if resource.price_per_day and "₹" in resource.price_per_day and int(resource.price_per_day.replace("₹", "").replace("/day", "")) <= 150 else 1
    duration_score = 3 if (resource.duration_days or 1) <= 3 else -2
    reliability_score = getattr(resource, "reliability", 85) * 0.1
    score = 50 + availability + condition_score + distance_score + price_score + duration_score + reliability_score
    return min(99, max(1, round(score)))
