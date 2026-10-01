import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from flask import Flask, send_file, send_from_directory
from werkzeug.security import generate_password_hash

from backend.config import Config
from backend.database import db
from backend.models import Booking, Notification, Prediction, Resource, User, Verification
from backend.routes.admin_routes import admin_bp
from backend.routes.ai_routes import ai_bp
from backend.routes.auth_routes import auth_bp
from backend.routes.booking_routes import booking_bp
from backend.routes.notification_routes import notification_bp
from backend.routes.prediction_routes import prediction_bp
from backend.routes.resource_routes import resource_bp
from backend.routes.review_routes import review_bp
from backend.routes.verification_routes import verification_bp



def create_app():
    app = Flask(__name__, static_folder=str(ROOT), static_url_path="")
    app.config.from_object(Config)
    db.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(resource_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(verification_bp)
    app.register_blueprint(review_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(prediction_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(ai_bp)

    @app.route("/")
    @app.route("/index.html")
    def serve_index():
        return send_file(ROOT / "index.html")

    @app.route("/uploads/<path:filename>")
    @app.route("/backend/uploads/<path:filename>")
    def serve_upload(filename):
        upload_dir = Path(Config.UPLOAD_FOLDER)
        return send_from_directory(upload_dir, filename)

    @app.route("/<path:path>")
    def serve_path(path):
        candidate = (ROOT / path).resolve()
        if candidate.exists() and candidate.is_file() and (ROOT in candidate.parents or candidate == ROOT):
            return send_file(candidate)
        return send_file(ROOT / "index.html")

    with app.app_context():
        db.create_all()
        seed_demo_data()

    return app


def seed_demo_data():
    if User.query.filter_by(email="admin@campus.edu").first():
        return

    admin = User(
        name="Campus Admin",
        email="admin@campus.edu",
        password_hash=generate_password_hash("admin123"),
        student_id="ADMIN-001",
        college="Campus",
        role="admin",
        verification_status="yes",
    )
    student = User(
        name="Aarav Sharma",
        email="student@campus.edu",
        password_hash=generate_password_hash("student123"),
        student_id="CS-2024-118",
        college="Campus",
        role="student",
        verification_status="yes",
    )
    db.session.add_all([admin, student])
    db.session.flush()

    demo_resources = [
        Resource(
            owner_id=student.id,
            name="Epson Projector",
            category="equip",
            description="HD projector with HDMI and remote",
            price_per_day="₹150/day",
            deposit="₹500",
            condition="Excellent",
            location="Library Wing",
            status="idle",
            utilization=31,
            last_used=None,
            icon="📽️",
            color="#EAF4EE",
            distance_km=0.8,
            reliability=96,
            duration_days=2,
        ),
        Resource(
            owner_id=student.id,
            name="Canon DSLR",
            category="equip",
            description="Canon EOS camera with 18-55mm lens",
            price_per_day="₹120/day",
            deposit="₹800",
            condition="Good",
            location="Media Lab",
            status="available",
            utilization=22,
            last_used=None,
            icon="📷",
            color="#FFE4DC",
            distance_km=1.4,
            reliability=94,
            duration_days=2,
        ),
        Resource(
            owner_id=student.id,
            name="Arduino Kit",
            category="equip",
            description="Starter kit with sensors and components",
            price_per_day="₹60/day",
            deposit="₹200",
            condition="Excellent",
            location="Innovation Center",
            status="available",
            utilization=54,
            last_used=None,
            icon="🔌",
            color="#FCEFD2",
            distance_km=0.6,
            reliability=91,
            duration_days=3,
        ),
        Resource(
            owner_id=admin.id,
            name="Study Pod Room",
            category="space",
            description="Quiet room with whiteboard and desk",
            price_per_day="₹80/day",
            deposit="₹300",
            condition="Excellent",
            location="North Block",
            status="available",
            utilization=68,
            last_used=None,
            icon="🪑",
            color="#CFEBDA",
            distance_km=0.9,
            reliability=90,
            duration_days=1,
        ),
        Resource(
            owner_id=student.id,
            name="Casio Scientific Calculator",
            category="equip",
            description="fx-991EX Classwiz with matrix and vector solver",
            price_per_day="₹25/day",
            deposit="₹100",
            condition="Excellent",
            location="Block C, Room 204",
            status="available",
            utilization=40,
            last_used=None,
            icon="🔢",
            color="#E4ECFB",
            distance_km=0.4,
            reliability=98,
            duration_days=2,
        ),
        Resource(
            owner_id=student.id,
            name="GATE Prep Guide & Engineering Maths",
            category="books",
            description="Complete 2025 Edition with solved papers & formula sheets",
            price_per_day="₹30/day",
            deposit="₹150",
            condition="Good",
            location="Central Library",
            status="available",
            utilization=60,
            last_used=None,
            icon="📚",
            color="#FCEFD2",
            distance_km=0.7,
            reliability=92,
            duration_days=5,
        ),
        Resource(
            owner_id=admin.id,
            name="Podcast & Audio Recording Studio",
            category="space",
            description="Soundproof booth with Shure SM7B mic and mixer",
            price_per_day="₹120/day",
            deposit="₹400",
            condition="Excellent",
            location="Media Complex",
            status="available",
            utilization=45,
            last_used=None,
            icon="🎙️",
            color="#FFE4DC",
            distance_km=1.2,
            reliability=95,
            duration_days=1,
        ),
    ]
    db.session.add_all(demo_resources)
    db.session.flush()

    db.session.add_all(
        [
            Notification(
                user_id=student.id,
                type="prediction",
                title="High demand forecast",
                message="Projectors are predicted to be in short supply next week.",
                is_read=False,
            ),
            Notification(
                user_id=student.id,
                type="activation",
                title="Activation opportunity",
                message="Your Epson Projector has been idle and may be needed soon.",
                is_read=False,
            ),
            Prediction(resource_category="projector", predicted_demand=12, current_supply=5, supply_gap=7, demand_level="high", prediction_period="Next 7 days"),
            Prediction(resource_category="dslr", predicted_demand=8, current_supply=6, supply_gap=2, demand_level="medium", prediction_period="Next 7 days"),
            Prediction(resource_category="arduino", predicted_demand=15, current_supply=10, supply_gap=5, demand_level="high", prediction_period="Next 7 days"),
        ]
    )

    db.session.commit()


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
