from flask import Blueprint, jsonify, request

from backend.database import db
from backend.models import Notification
from backend.routes.auth_routes import auth_required

notification_bp = Blueprint("notification", __name__)


@notification_bp.route("/api/notifications", methods=["GET"])
@auth_required
def list_notifications():
    items = Notification.query.filter_by(user_id=request.current_user.id).order_by(Notification.created_at.desc()).all()
    return jsonify({"notifications": [n.to_dict() for n in items]})


@notification_bp.route("/api/notifications/<int:notification_id>/read", methods=["PUT"])
@notification_bp.route("/api/notifications/<int:notification_id>", methods=["PUT"])
@auth_required
def mark_read(notification_id):
    notification = Notification.query.get_or_404(notification_id)
    if notification.user_id != request.current_user.id:
        return jsonify({"error": "Access denied"}), 403
    notification.is_read = True
    db.session.commit()
    return jsonify({"message": "Notification marked as read", "notification": notification.to_dict()})


@notification_bp.route("/api/notifications/read-all", methods=["PUT"])
@auth_required
def mark_all_read():
    Notification.query.filter_by(user_id=request.current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read"})
