from datetime import datetime, timedelta

import jwt
from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from backend.config import Config
from backend.database import db
from backend.models import User

auth_bp = Blueprint("auth", __name__)


def create_token(user):
    payload = {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")


def auth_required(view_func):
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        user = User.query.get(payload.get("user_id"))
        if not user:
            return jsonify({"error": "User not found"}), 401
        request.current_user = user
        return view_func(*args, **kwargs)

    decorated.__name__ = view_func.__name__
    return decorated


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="student",
        verification_status="no",
    )
    db.session.add(user)
    db.session.commit()
    token = create_token(user)
    return jsonify({"token": token, "user": user.to_dict()})


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Incorrect email or password"}), 401

    token = create_token(user)
    return jsonify({"token": token, "user": user.to_dict()})


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    return jsonify({"message": "Logged out successfully"})


@auth_bp.route("/api/auth/me", methods=["GET"])
@auth_required
def me():
    return jsonify({"user": request.current_user.to_dict()})
