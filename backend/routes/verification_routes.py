from datetime import datetime
from pathlib import Path
import uuid

from flask import Blueprint, current_app, jsonify, request

from backend.database import db
from backend.models import Verification
from backend.routes.auth_routes import auth_required

verification_bp = Blueprint("verification", __name__)


@verification_bp.route("/api/verification/submit", methods=["POST"])
@auth_required
def submit_verification():
    data = request.get_json(silent=True) or {}
    student_id = (request.form.get("student_id") or data.get("student_id") or "").strip()
    name = (request.form.get("name") or data.get("name") or "").strip()
    if not student_id:
        return jsonify({"error": "Student ID is required"}), 400

    if name:
        request.current_user.name = name

    file_name = ""
    uploaded_file = request.files.get("document") or request.files.get("file")
    if uploaded_file and uploaded_file.filename:
        upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid.uuid4().hex}_{uploaded_file.filename}"
        file_path = upload_dir / safe_name
        uploaded_file.save(file_path)
        file_name = f"/backend/uploads/{safe_name}"

    verification = Verification(
        user_id=request.current_user.id,
        student_id=student_id,
        document_path=file_name,
        status="pending",
        submitted_at=datetime.utcnow(),
    )
    request.current_user.student_id = student_id
    request.current_user.verification_status = "pending"
    db.session.add(verification)
    db.session.commit()
    return jsonify({"message": "Verification submitted", "verification": verification.to_dict()})


@verification_bp.route("/api/verification/status", methods=["GET"])
@auth_required
def verification_status():
    latest = Verification.query.filter_by(user_id=request.current_user.id).order_by(Verification.submitted_at.desc()).first()
    return jsonify({
        "status": request.current_user.verification_status,
        "verification": latest.to_dict() if latest else None,
    })


@verification_bp.route("/api/admin/verifications", methods=["GET"])
@auth_required
def admin_verifications():
    if request.current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403
    records = Verification.query.order_by(Verification.submitted_at.desc()).all()
    return jsonify({"verifications": [v.to_dict() for v in records]})


@verification_bp.route("/api/admin/verifications/<int:verification_id>", methods=["PUT"])
@auth_required
def update_verification(verification_id):
    if request.current_user.role != "admin":
        return jsonify({"error": "Admin access required"}), 403

    verification = Verification.query.get_or_404(verification_id)
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip().lower()
    if status not in {"approved", "rejected"}:
        return jsonify({"error": "status must be approved or rejected"}), 400

    verification.status = status
    verification.verified_at = datetime.utcnow()
    verification.verified_by = request.current_user.id

    user = verification.user
    user.verification_status = "yes" if status == "approved" else "no"
    db.session.commit()
    return jsonify({"message": f"Verification {status}", "verification": verification.to_dict()})
