from datetime import datetime

from flask import Blueprint, jsonify, request

from backend.database import db
from backend.models import Booking, Notification, Resource, User
from backend.routes.auth_routes import auth_required
from backend.services.activation_service import suggest_activations
from backend.services.idle_resource_service import find_idle_resources
from backend.services.matching_service import calculate_match_score

resource_bp = Blueprint("resource", __name__)


def resource_payload(resource):
    payload = resource.to_dict()
    payload["ownerEmail"] = resource.owner.email if resource.owner else None
    payload["bg"] = resource.color
    payload["sub"] = resource.description
    payload["price"] = resource.price_per_day
    payload["ic"] = resource.icon
    payload["cat"] = resource.category
    payload["distanceKm"] = resource.distance_km
    payload["condition"] = resource.condition
    payload["reliability"] = resource.reliability
    payload["durationDays"] = resource.duration_days
    return payload


@resource_bp.route("/api/resources", methods=["GET"])
def list_resources():
    resources = Resource.query.order_by(Resource.created_at.desc()).all()
    return jsonify({"resources": [resource_payload(r) for r in resources]})


@resource_bp.route("/api/resources/idle", methods=["GET"])
def idle_resources():
    resources = find_idle_resources()
    return jsonify({"resources": [resource_payload(r) for r in resources]})


@resource_bp.route("/api/resources/<int:resource_id>", methods=["GET"])
def get_resource(resource_id):
    resource = Resource.query.get_or_404(resource_id)
    return jsonify({"resource": resource_payload(resource)})


@resource_bp.route("/api/resources", methods=["POST"])
@auth_required
def create_resource():
    user = request.current_user
    if user.verification_status != "yes":
        return jsonify({"error": "Only verified students can list resources"}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip()
    category = (data.get("category") or "equip").strip()
    if not name or not description:
        return jsonify({"error": "Resource name and description are required"}), 400

    resource = Resource(
        owner_id=user.id,
        name=name,
        category=category,
        description=description,
        price_per_day=data.get("price_per_day") or "Free",
        deposit=data.get("deposit") or "",
        condition=data.get("condition") or "Good",
        location=data.get("location") or "Campus",
        status=data.get("status") or "available",
        utilization=data.get("utilization") or 0,
        last_used=datetime.utcnow(),
        icon=data.get("icon") or "📦",
        color=data.get("color") or "#EAF4EE",
        distance_km=float(data.get("distance_km") or 1.0),
        reliability=int(data.get("reliability") or 90),
        duration_days=int(data.get("duration_days") or 1),
    )
    db.session.add(resource)
    db.session.commit()
    return jsonify({"message": "Resource created", "resource": resource_payload(resource)})


@resource_bp.route("/api/resources/<int:resource_id>", methods=["PUT"])
@auth_required
def update_resource(resource_id):
    resource = Resource.query.get_or_404(resource_id)
    if resource.owner_id != request.current_user.id and request.current_user.role != "admin":
        return jsonify({"error": "You can only edit your own resources"}), 403

    data = request.get_json(silent=True) or {}
    for field in ["name", "category", "description", "price_per_day", "condition", "location", "status", "icon", "deposit", "color"]:
        if field in data:
            setattr(resource, field, data[field])
    if "utilization" in data:
        resource.utilization = int(data["utilization"])
    if "distance_km" in data:
        resource.distance_km = float(data["distance_km"])
    if "reliability" in data:
        resource.reliability = int(data["reliability"])
    if "duration_days" in data:
        resource.duration_days = int(data["duration_days"])

    db.session.commit()
    return jsonify({"message": "Resource updated", "resource": resource_payload(resource)})


@resource_bp.route("/api/resources/<int:resource_id>", methods=["DELETE"])
@auth_required
def delete_resource(resource_id):
    resource = Resource.query.get_or_404(resource_id)
    if resource.owner_id != request.current_user.id and request.current_user.role != "admin":
        return jsonify({"error": "You can only delete your own resources"}), 403
    Booking.query.filter_by(resource_id=resource.id).delete()
    db.session.delete(resource)
    db.session.commit()
    return jsonify({"message": "Resource deleted"})


@resource_bp.route("/api/resources/<int:resource_id>/activate", methods=["POST"])
@auth_required
def activate_resource(resource_id):
    resource = Resource.query.get_or_404(resource_id)
    if resource.owner_id != request.current_user.id and request.current_user.role != "admin":
        return jsonify({"error": "Only the owner can activate a resource"}), 403
    resource.status = "available"
    resource.utilization = max(0, min(100, resource.utilization))
    db.session.add(
        Notification(
            user_id=resource.owner_id,
            type="activation",
            title="Resource activated",
            message=f"Your {resource.name} has been activated and is now available for booking.",
        )
    )
    db.session.commit()
    return jsonify({"message": "Resource activated", "resource": resource_payload(resource)})


@resource_bp.route("/api/matches", methods=["GET"])
def smart_matches():
    resources = Resource.query.filter(Resource.status == "available").all()
    results = []
    for r in resources:
        score = calculate_match_score(r)
        results.append({"resource_id": r.id, "name": r.name, "match_percentage": score, "category": r.category})
    results.sort(key=lambda x: x["match_percentage"], reverse=True)
    return jsonify({"matches": results})
