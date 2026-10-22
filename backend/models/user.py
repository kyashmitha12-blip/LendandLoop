from datetime import datetime
from backend.database import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    student_id = db.Column(db.String(80), default="")
    college = db.Column(db.String(120), default="Campus")
    role = db.Column(db.String(20), default="student")
    verification_status = db.Column(db.String(20), default="no")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    resources = db.relationship("Resource", backref="owner", lazy=True)
    bookings_borrowed = db.relationship("Booking", foreign_keys="Booking.borrower_id", backref="borrower", lazy=True)
    bookings_owned = db.relationship("Booking", foreign_keys="Booking.owner_id", backref="owner_booking", lazy=True)
    notifications = db.relationship("Notification", backref="user", lazy=True)
    verifications = db.relationship("Verification", backref="user", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "student_id": self.student_id,
            "college": self.college,
            "role": self.role,
            "verification_status": self.verification_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
