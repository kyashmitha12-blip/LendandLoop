from datetime import datetime
from backend.database import db


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
