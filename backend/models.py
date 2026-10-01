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


class Resource(db.Model):
    __tablename__ = "resources"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(160), nullable=False)
    category = db.Column(db.String(50), nullable=False, default="equip")
    description = db.Column(db.Text, default="")
    price_per_day = db.Column(db.String(60), default="Free")
    deposit = db.Column(db.String(60), default="")
    condition = db.Column(db.String(50), default="Good")
    location = db.Column(db.String(160), default="Campus")
    status = db.Column(db.String(30), default="available")
    utilization = db.Column(db.Integer, default=0)
    last_used = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    icon = db.Column(db.String(10), default="📦")
    color = db.Column(db.String(20), default="#EAF4EE")
    distance_km = db.Column(db.Float, default=1.0)
    reliability = db.Column(db.Integer, default=90)
    duration_days = db.Column(db.Integer, default=2)

    bookings = db.relationship("Booking", backref="resource", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "owner_email": self.owner.email if self.owner else None,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "price_per_day": self.price_per_day,
            "deposit": self.deposit,
            "condition": self.condition,
            "location": self.location,
            "status": self.status,
            "utilization": self.utilization,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "icon": self.icon,
            "color": self.color,
            "distance_km": self.distance_km,
            "reliability": self.reliability,
            "duration_days": self.duration_days,
        }


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, db.ForeignKey("resources.id"), nullable=False)
    borrower_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    pickup_point = db.Column(db.String(160), default="Campus hub")
    price = db.Column(db.String(60), default="₹0")
    deposit = db.Column(db.String(60), default="₹0")
    status = db.Column(db.String(20), default="requested")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    returned_at = db.Column(db.DateTime, nullable=True)

    reviews = db.relationship("Review", backref="booking", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "resource_id": self.resource_id,
            "resource_name": self.resource.name if self.resource else None,
            "borrower_id": self.borrower_id,
            "owner_id": self.owner_id,
            "borrower_email": self.borrower.email if self.borrower else None,
            "owner_email": self.owner_booking.email if self.owner_booking else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "pickup_point": self.pickup_point,
            "price": self.price,
            "deposit": self.deposit,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "returned_at": self.returned_at.isoformat() if self.returned_at else None,
        }


class Verification(db.Model):
    __tablename__ = "verifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    student_id = db.Column(db.String(80), nullable=False)
    document_path = db.Column(db.String(255), default="")
    status = db.Column(db.String(20), default="pending")
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    verified_at = db.Column(db.DateTime, nullable=True)
    verified_by = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        doc_url = ""
        if self.document_path:
            clean_name = self.document_path.replace("\\", "/").split("/")[-1]
            doc_url = f"/uploads/{clean_name}"

        return {
            "id": self.id,
            "user_id": self.user_id,
            "student_name": self.user.name if self.user else "Student",
            "student_email": self.user.email if self.user else "",
            "student_id": self.student_id,
            "document_path": doc_url,
            "status": self.status,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "verified_by": self.verified_by,
        }


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


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(40), default="general")
    title = db.Column(db.String(180), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Prediction(db.Model):
    __tablename__ = "predictions"

    id = db.Column(db.Integer, primary_key=True)
    resource_category = db.Column(db.String(50), nullable=False)
    predicted_demand = db.Column(db.Integer, default=0)
    current_supply = db.Column(db.Integer, default=0)
    supply_gap = db.Column(db.Integer, default=0)
    demand_level = db.Column(db.String(20), default="medium")
    prediction_period = db.Column(db.String(50), default="Next 7 days")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "resource_category": self.resource_category,
            "predicted_demand": self.predicted_demand,
            "current_supply": self.current_supply,
            "supply_gap": self.supply_gap,
            "demand_level": self.demand_level,
            "prediction_period": self.prediction_period,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
