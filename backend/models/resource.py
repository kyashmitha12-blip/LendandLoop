from datetime import datetime
from backend.database import db


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
