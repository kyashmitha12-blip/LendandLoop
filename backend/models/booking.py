from datetime import datetime
from backend.database import db


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
    return_condition = db.Column(db.String(50), default="Good")
    notes = db.Column(db.Text, default="")
    return_image = db.Column(db.String(255), default="")

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
            "return_condition": self.return_condition,
            "notes": self.notes,
            "return_image": self.return_image,
        }
