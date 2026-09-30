from datetime import datetime

from flask import Blueprint, jsonify, request

from backend.database import db
from backend.models import Booking, Notification, Resource, User
from backend.routes.auth_routes import auth_required

booking_bp = Blueprint("booking", __name__)


@booking_bp.route("/api/bookings/my", methods=["GET"])
@auth_required
def my_bookings():
    bookings = Booking.query.filter_by(borrower_id=request.current_user.id).order_by(Booking.created_at.desc()).all()
    return jsonify({"bookings": [b.to_dict() for b in bookings]})


@booking_bp.route("/api/bookings/owner", methods=["GET"])
@auth_required
def owner_bookings():
    bookings = Booking.query.filter_by(owner_id=request.current_user.id).order_by(Booking.created_at.desc()).all()
    return jsonify({"bookings": [b.to_dict() for b in bookings]})


@booking_bp.route("/api/bookings", methods=["POST"])
@auth_required
def create_booking():
    data = request.get_json(silent=True) or {}
    resource_id = data.get("resource_id")
    if not resource_id:
        return jsonify({"error": "resource_id is required"}), 400

    resource = Resource.query.get(resource_id)
    if not resource:
        return jsonify({"error": "Resource not found"}), 404
    if resource.status != "available":
        return jsonify({"error": "Resource is not available for booking"}), 409

    booking = Booking(
        resource_id=resource.id,
        borrower_id=request.current_user.id,
        owner_id=resource.owner_id,
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow(),
        pickup_point=data.get("pickup_point") or "Main campus hub",
        price=data.get("price") or resource.price_per_day,
        deposit=data.get("deposit") or "",
        status="active",
    )
    resource.status = "booked"
    resource.utilization = min(100, (resource.utilization or 0) + 10)
    db.session.add(booking)
    db.session.add(
        Notification(
            user_id=resource.owner_id,
            type="booking",
            title="New booking",
            message=f"{request.current_user.name} booked your {resource.name}.",
        )
    )
    db.session.commit()
    return jsonify({"message": "Booking confirmed", "booking": booking.to_dict()})


@booking_bp.route("/api/bookings/<int:booking_id>", methods=["GET"])
@auth_required
def get_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if booking.borrower_id != request.current_user.id and booking.owner_id != request.current_user.id and request.current_user.role != "admin":
        return jsonify({"error": "Access denied"}), 403
    return jsonify({"booking": booking.to_dict()})


@booking_bp.route("/api/bookings/<int:booking_id>/status", methods=["PUT"])
@auth_required
def update_booking_status(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        return jsonify({"error": "status is required"}), 400
    if booking.owner_id != request.current_user.id and request.current_user.role != "admin":
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
    if booking.borrower_id != request.current_user.id:
        return jsonify({"error": "Only the borrower can return the resource"}), 403

    booking.status = "returned"
    booking.returned_at = datetime.utcnow()
    resource = Resource.query.get(booking.resource_id)
    if resource:
        resource.status = "available"
        resource.last_used = datetime.utcnow()
    db.session.add(
        Notification(
            user_id=booking.owner_id,
            type="return",
            title="Resource returned",
            message=f"{request.current_user.name} returned your {resource.name}.",
        )
    )
    db.session.commit()
    return jsonify({"message": "Resource returned", "booking": booking.to_dict()})
