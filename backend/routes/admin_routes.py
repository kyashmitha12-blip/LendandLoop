from flask import Blueprint, jsonify, request

from backend.models import Booking, Prediction, Resource, User
from backend.routes.auth_routes import auth_required
from backend.services.activation_service import suggest_activations

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/api/admin/analytics", methods=["GET"])
@auth_required
def admin_analytics():
    if request.current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403

    students = User.query.filter_by(role="student").count()
    verified_students = User.query.filter_by(role="student", verification_status="yes").count()
    total_resources = Resource.query.count()
    active_resources = Resource.query.filter(Resource.status.in_(["available", "booked"])).count()
    idle_resources = Resource.query.filter(Resource.status == "idle").count()
    active_bookings = Booking.query.filter_by(status="active").count()
    completed_bookings = Booking.query.filter_by(status="returned").count()
    shortages = Prediction.query.filter(Prediction.supply_gap > 0).count()
    all_resources = Resource.query.all()
    avg_utilization = round(
        sum(r.utilization or 0 for r in all_resources) / max(1, total_resources), 2
    )
    # Count activations (resources that were idle and became available via /activate)
    activation_notifications = __import__("backend.models", fromlist=["Notification"]).Notification
    activated_count = activation_notifications.query.filter_by(type="activation").count()

    return jsonify({
        "total_students": students,
        "verified_students": verified_students,
        "total_resources": total_resources,
        "active_resources": active_resources,
        "idle_resources": idle_resources,
        "active_bookings": active_bookings,
        "completed_bookings": completed_bookings,
        "utilization": avg_utilization,
        "predicted_shortages": shortages,
        "activated_resources": activated_count,
    })


@admin_bp.route("/api/admin/activations", methods=["GET"])
@auth_required
def admin_activations():
    """Return a list of idle resources that can be activated (admin view)."""
    if request.current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403
    suggestions = suggest_activations()
    return jsonify({"activations": suggestions})
