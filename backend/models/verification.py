from datetime import datetime
from backend.database import db


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
