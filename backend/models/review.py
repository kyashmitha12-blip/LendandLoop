from datetime import datetime
from backend.database import db


class Review(db.Model):
    __tablename__ = "reviews"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    rating = db.Column(db.Integer, default=5)
    comment = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "reviewer_id": self.reviewer_id,
            "reviewed_user_id": self.reviewed_user_id,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
