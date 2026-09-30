from flask import Blueprint, jsonify, request

from backend.models import Booking, Prediction, Resource, User
from backend.routes.auth_routes import auth_required

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/api/admin/analytics", methods=["GET"])
@auth_required
def admin_analytics():
    if request.current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403

    students = User.query.filter_by(role="student").count()
    verified_students = User.query.filter_by(role="student", verification_status="yes").count()
    resources = Resource.query.count()
    active_bookings = Booking.query.filter_by(status="active").count()
    completed_bookings = Booking.query.filter_by(status="returned").count()
    idle_resources = Resource.query.filter_by(status="idle").count()
    shortages = Prediction.query.filter(Prediction.supply_gap > 0).count()

    return jsonify({
        "total_students": students,
        "verified_students": verified_students,
        "total_resources": resources,
        "active_bookings": active_bookings,
        "completed_bookings": completed_bookings,
        "idle_resources": idle_resources,
        "predicted_shortages": shortages,
        "utilization": round(sum(r.utilization or 0 for r in Resource.query.all()) / max(1, resources), 2),
    })
