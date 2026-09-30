from flask import Blueprint, jsonify, request

from backend.database import db
from backend.models import Review, User
from backend.routes.auth_routes import auth_required

review_bp = Blueprint("review", __name__)


@review_bp.route("/api/reviews", methods=["POST"])
@auth_required
def create_review():
    data = request.get_json(silent=True) or {}
    reviewed_user_id = data.get("reviewed_user_id")
    rating = int(data.get("rating") or 5)
    comment = (data.get("comment") or "").strip()
    if not reviewed_user_id:
        return jsonify({"error": "reviewed_user_id is required"}), 400
    review = Review(
        booking_id=data.get("booking_id") or 0,
        reviewer_id=request.current_user.id,
        reviewed_user_id=reviewed_user_id,
        rating=max(1, min(5, rating)),
        comment=comment,
    )
    db.session.add(review)
    db.session.commit()
    return jsonify({"message": "Review added", "review": review.to_dict()})


@review_bp.route("/api/users/<int:user_id>/reviews", methods=["GET"])
def user_reviews(user_id):
    reviews = Review.query.filter_by(reviewed_user_id=user_id).all()
    user = User.query.get_or_404(user_id)
    average = round(sum(r.rating for r in reviews) / len(reviews), 2) if reviews else 0
    return jsonify({"user": user.to_dict(), "average_rating": average, "reviews": [r.to_dict() for r in reviews]})
