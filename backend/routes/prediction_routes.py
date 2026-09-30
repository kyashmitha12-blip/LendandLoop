from flask import Blueprint, jsonify, request

from backend.database import db
from backend.models import Prediction, Resource
from backend.routes.auth_routes import auth_required
from backend.services.prediction_service import build_prediction_snapshot

prediction_bp = Blueprint("prediction", __name__)


@prediction_bp.route("/api/predictions", methods=["GET"])
def get_predictions():
    predictions = build_prediction_snapshot()
    return jsonify({"predictions": predictions})


@prediction_bp.route("/api/supply-gaps", methods=["GET"])
def supply_gaps():
    results = []
    for prediction in build_prediction_snapshot():
        results.append({
            "resource_category": prediction["resource_category"],
            "predicted_demand": prediction["predicted_demand"],
            "current_supply": prediction["current_supply"],
            "supply_gap": prediction["supply_gap"],
            "demand_level": prediction["demand_level"],
        })
    return jsonify({"supply_gaps": results})


@prediction_bp.route("/api/admin/predictions", methods=["POST"])
@auth_required
def regenerate_predictions():
    if request.current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403
    predictions = build_prediction_snapshot()
    for pred in predictions:
        existing = Prediction.query.filter_by(resource_category=pred["resource_category"]).first()
        if existing:
            existing.predicted_demand = pred["predicted_demand"]
            existing.current_supply = pred["current_supply"]
            existing.supply_gap = pred["supply_gap"]
            existing.demand_level = pred["demand_level"]
            existing.prediction_period = pred["prediction_period"]
        else:
            db.session.add(Prediction(**pred))
    db.session.commit()
    return jsonify({"message": "Predictions refreshed", "predictions": predictions})
