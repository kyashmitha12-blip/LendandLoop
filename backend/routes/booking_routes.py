"""
Booking routes
--------------
Handles resource booking, status management, and return flow.
Server-side availability checking prevents double-booking.
"""
from datetime import datetime

from flask import Blueprint, jsonify, request

from backend.database import db
from backend.models import Booking, Notification, Resource, User
from backend.routes.auth_routes import auth_required

booking_bp = Blueprint("booking", __name__)


def _parse_date(value):
    """Parse ISO date string or return None."""
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d")
        except ValueError:
            pass
    return None


def _check_availability(resource_id: int, start: datetime, end: datetime, exclude_booking_id: int = None) -> bool:
    """
    Return True if the resource is free in [start, end].
    Checks for overlapping active/confirmed bookings in the database.
    """
    q = Booking.query.filter(
        Booking.resource_id == resource_id,
        Booking.status.in_(["active", "confirmed", "requested"]),
        Booking.start_date < end,
        Booking.end_date > start,
    )
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    return q.count() == 0


@booking_bp.route("/api/bookings/my", methods=["GET"])
@auth_required
def my_bookings():
    bookings = (
        Booking.query
        .filter_by(borrower_id=request.current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    return jsonify({"bookings": [b.to_dict() for b in bookings]})


@booking_bp.route("/api/bookings/owner", methods=["GET"])
@auth_required
def owner_bookings():
    bookings = (
        Booking.query
        .filter_by(owner_id=request.current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    return jsonify({"bookings": [b.to_dict() for b in bookings]})


@booking_bp.route("/api/bookings", methods=["POST"])
@auth_required
def create_booking():
    user = request.current_user
    if user.verification_status != "yes":
        return jsonify({"error": "Only verified students can book resources"}), 403

    data = request.get_json(silent=True) or {}
    resource_id = data.get("resource_id")
    if not resource_id:
        return jsonify({"error": "resource_id is required"}), 400

    resource = Resource.query.get(resource_id)
    if not resource:
        return jsonify({"error": "Resource not found"}), 404
    if resource.status not in ("available",):
        return jsonify({"error": f"Resource is not available for booking (status: {resource.status})"}), 409
    if resource.owner_id == user.id:
        return jsonify({"error": "You cannot book your own resource"}), 400

    # Parse or default dates
    start = _parse_date(data.get("start_date")) or datetime.utcnow()
    end = _parse_date(data.get("end_date")) or datetime.utcnow()
    if end <= start:
        # Default to a 1-day booking
        from datetime import timedelta
        end = start + timedelta(days=1)

    # Server-side double-booking check
    if not _check_availability(resource.id, start, end):
        return jsonify({"error": "Resource is already booked during the requested dates"}), 409

    booking = Booking(
        resource_id=resource.id,
        borrower_id=user.id,
        owner_id=resource.owner_id,
        start_date=start,
        end_date=end,
        pickup_point=data.get("pickup_point") or "Main campus hub",
        price=data.get("price") or resource.price_per_day,
        deposit=data.get("deposit") or resource.deposit or "",
        status="active",
    )
    resource.status = "booked"
    resource.utilization = min(100, (resource.utilization or 0) + 10)
    db.session.add(booking)

    # Notify owner
    db.session.add(Notification(
        user_id=resource.owner_id,
        type="booking",
        title="New booking request",
        message=f"{user.name} booked your {resource.name}.",
    ))
    db.session.commit()
    return jsonify({"message": "Booking confirmed", "booking": booking.to_dict()}), 201


@booking_bp.route("/api/bookings/<int:booking_id>", methods=["GET"])
@auth_required
def get_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    user = request.current_user
    if booking.borrower_id != user.id and booking.owner_id != user.id and user.role != "admin":
        return jsonify({"error": "Access denied"}), 403
    return jsonify({"booking": booking.to_dict()})


@booking_bp.route("/api/bookings/<int:booking_id>/status", methods=["PUT"])
@auth_required
def update_booking_status(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    user = request.current_user
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").lower().strip()
    allowed = {"requested", "confirmed", "active", "returned", "cancelled"}
    if status not in allowed:
        return jsonify({"error": f"status must be one of: {', '.join(sorted(allowed))}"}), 400
    if booking.owner_id != user.id and user.role != "admin":
        return jsonify({"error": "Only the owner or admin can update booking status"}), 403

    booking.status = status
    if status == "returned":
        booking.returned_at = datetime.utcnow()
        resource = Resource.query.get(booking.resource_id)
        if resource:
            resource.status = "available"
            resource.last_used = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "Booking status updated", "booking": booking.to_dict()})


@booking_bp.route("/api/bookings/<int:booking_id>/return", methods=["POST"])
@auth_required
def return_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    user = request.current_user
    if booking.borrower_id != user.id:
        return jsonify({"error": "Only the borrower can return the resource"}), 403
    if booking.status not in ("active", "confirmed"):
        return jsonify({"error": f"Cannot return a booking with status '{booking.status}'"}), 400

    data = request.get_json(silent=True) or {}
    booking.status = "returned"
    booking.returned_at = datetime.utcnow()

    resource = Resource.query.get(booking.resource_id)
    if resource:
        resource.status = "available"
        resource.last_used = datetime.utcnow()
        # Bump utilization slightly on successful return
        resource.utilization = min(100, (resource.utilization or 0) + 5)

    db.session.add(Notification(
        user_id=booking.owner_id,
        type="return",
        title="Resource returned",
        message=f"{user.name} returned your {resource.name if resource else 'resource'}.",
    ))
    db.session.commit()
    return jsonify({"message": "Resource returned successfully", "booking": booking.to_dict()})
