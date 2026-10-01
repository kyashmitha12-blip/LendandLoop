"""
AI Routes
---------
Endpoints for LoopBot conversational agent and AI Vision condition inspection.
"""

from flask import Blueprint, jsonify, request
from backend.routes.auth_routes import auth_required
from backend.services.ai_agent_service import chat_with_agent, analyze_return_image

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/ai/chat", methods=["POST"])
@auth_required
def ai_chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Message is required"}), 400
        
    response = chat_with_agent(message, user=request.current_user)
    return jsonify(response)


@ai_bp.route("/api/ai/vision-inspect", methods=["POST"])
@auth_required
def vision_inspect():
    file = request.files.get("photo")
    if not file or not file.filename:
        return jsonify({"error": "Please upload a photo of the item to inspect"}), 400
        
    booking_id = request.form.get("booking_id")
    result = analyze_return_image(file, booking_id=booking_id, user=request.current_user)
    return jsonify(result)
