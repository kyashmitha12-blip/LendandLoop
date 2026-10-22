import io
import json
import os
import sys
from pathlib import Path

# Ensure root in path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8")

import backend.app as app_mod

app = app_mod.create_app()
client = app.test_client()

print("=== 1. Health Check ===")
r = client.get("/api/health")
assert r.status_code == 200, r.get_data(as_text=True)
print("Health OK:", r.get_json())

print("\n=== 2. Authentication ===")
# Admin login
r = client.post("/api/auth/login", json={"email": "admin@campus.edu", "password": "admin123"})
assert r.status_code == 200, r.get_data(as_text=True)
admin_token = r.get_json()["token"]
admin_auth = {"Authorization": f"Bearer {admin_token}"}
print("Admin Login OK")

# Primary Student login
r = client.post("/api/auth/login", json={"email": "student@campus.edu", "password": "student123"})
assert r.status_code == 200, r.get_data(as_text=True)
student_token = r.get_json()["token"]
student_id = r.get_json()["user"]["id"]
student_auth = {"Authorization": f"Bearer {student_token}"}
print("Student Login OK")

# Register second student for booking & borrowing
r = client.post("/api/auth/register", json={
    "name": "Priya Patel",
    "email": "priya@campus.edu",
    "password": "password123",
    "student_id": "CS-2024-205",
    "college": "Campus"
})
if r.status_code == 400 and "already exists" in r.get_data(as_text=True):
    r = client.post("/api/auth/login", json={"email": "priya@campus.edu", "password": "password123"})
assert r.status_code in (200, 201), r.get_data(as_text=True)
borrower_token = r.get_json()["token"]
borrower_id = r.get_json()["user"]["id"]
borrower_auth = {"Authorization": f"Bearer {borrower_token}"}
print("Second Student (Borrower) Auth OK")

# Verify borrower so they can book
r_auto_verify = client.post("/api/verification/submit", headers=borrower_auth, data={
    "student_id": "CS-2024-205",
    "name": "Priya Patel"
})
# Admin approves borrower
r_q = client.get("/api/admin/verifications", headers=admin_auth)
v_list = r_q.get_json().get("verifications", [])
for v in v_list:
    if v["user_id"] == borrower_id:
        client.put(f"/api/admin/verifications/{v['id']}", headers=admin_auth, json={"status": "approved"})
        break

print("\n=== 3. User Routes & Trust Stats ===")
r = client.get(f"/api/users/{student_id}", headers=student_auth)
assert r.status_code == 200
u_data = r.get_json().get("user", {})
print("User profile OK:", u_data.get("name"))

r = client.get(f"/api/users/{student_id}/stats", headers=student_auth)
assert r.status_code == 200
print("User stats OK:", r.get_json())

print("\n=== 4. Resources & Idle Tracking ===")
r = client.get("/api/resources")
assert r.status_code == 200
resources = r.get_json().get("resources", [])
print(f"Resources count: {len(resources)}")
res_idle = next(x for x in resources if x.get("status") == "idle" and x.get("owner_id") == student_id)
res_avail = next(x for x in resources if x.get("status") == "available" and x.get("owner_id") == student_id)

r = client.get(f"/api/resources/{res_idle['id']}/history", headers=student_auth)
assert r.status_code == 200, r.get_data(as_text=True)
print("Resource history OK:", r.get_json())

r = client.post(f"/api/resources/{res_avail['id']}/idle", headers=student_auth)
assert r.status_code == 200
print("Resource mark idle OK")

# Reset status back to available for booking test
r = client.put(f"/api/resources/{res_avail['id']}", headers=student_auth, json={"status": "available"})
assert r.status_code == 200

print("\n=== 5. Activation Opportunities & Nudges ===")
r = client.get("/api/activations/opportunities", headers=admin_auth)
assert r.status_code == 200
print(f"Opportunities count: {len(r.get_json().get('opportunities', []))}")

r = client.post("/api/activations/nudge", headers=admin_auth, json={"resource_id": res_idle["id"]})
assert r.status_code == 200
print("Nudge OK:", r.get_json())

print("\n=== 6. Bookings & Return Flow ===")
# Priya books Aarav's resource
r = client.post("/api/bookings", headers=borrower_auth, json={
    "resource_id": res_avail["id"],
    "start_date": "2026-11-01",
    "end_date": "2026-11-03",
    "pickup_point": "Main Library Desk",
    "price": "₹120/day",
    "deposit": "₹800"
})
assert r.status_code in (200, 201), r.get_data(as_text=True)
booking = r.get_json()["booking"]
booking_id = booking["id"]
print(f"Booking created OK: ID {booking_id}")

# Double-booking conflict check
r_conflict = client.post("/api/bookings", headers=borrower_auth, json={
    "resource_id": res_avail["id"],
    "start_date": "2026-11-02",
    "end_date": "2026-11-04"
})
assert r_conflict.status_code in (400, 409), "Double booking must be blocked!"
print("Conflict prevented successfully (server-side availability enforced)")

# Return flow
r_return = client.post(f"/api/bookings/{booking_id}/return", headers=borrower_auth, json={
    "condition": "Clean and undamaged",
    "notes": "Returned on time to desk"
})
assert r_return.status_code == 200, r_return.get_data(as_text=True)
print("Return flow OK")

print("\n=== 7. Verifications ===")
data = {
    "student_id": "TEST-CARD-999",
    "document": (io.BytesIO(b"sample id card photo"), "student_id_card.png")
}
r_verif = client.post("/api/verification/submit", headers=borrower_auth, data=data, content_type="multipart/form-data")
assert r_verif.status_code in (200, 201), r_verif.get_data(as_text=True)
print("Verification submitted OK")

r_verif_admin = client.get("/api/admin/verifications", headers=admin_auth)
assert r_verif_admin.status_code == 200
v_list = r_verif_admin.get_json().get("verifications", [])
print(f"Admin verification queue count: {len(v_list)}")
if v_list:
    target_v_id = v_list[0]["id"]
    r_approve = client.put(f"/api/admin/verifications/{target_v_id}", headers=admin_auth, json={"status": "approved"})
    assert r_approve.status_code == 200
    print(f"Admin approved verification #{target_v_id} OK")

print("\n=== 8. Demand Predictions ===")
r_pred = client.get("/api/predictions")
assert r_pred.status_code == 200
print(f"Predictions count: {len(r_pred.get_json().get('predictions', []))}")

r_regen = client.post("/api/admin/predictions", headers=admin_auth)
assert r_regen.status_code == 200
print("Predictions regenerated OK")

print("\n=== 9. Notifications ===")
r_notif = client.get("/api/notifications", headers=student_auth)
assert r_notif.status_code == 200
print(f"Notifications count: {len(r_notif.get_json().get('notifications', []))}")

print("\n=== 10. Reviews & Trust Score ===")
r_rev = client.post("/api/reviews", headers=borrower_auth, json={
    "booking_id": booking_id,
    "reviewed_user_id": student_id,
    "rating": 5,
    "comment": "Super helpful owner, item was in pristine condition!"
})
assert r_rev.status_code in (200, 201), r_rev.get_data(as_text=True)
print("Review created OK")

r_get_revs = client.get(f"/api/users/{student_id}/reviews")
assert r_get_revs.status_code == 200
print("User reviews fetched OK:", len(r_get_revs.get_json().get("reviews", [])))

print("\n=== 11. AI Services ===")
r_chat = client.post("/api/ai/chat", headers=student_auth, json={"message": "How do I borrow a projector?"})
assert r_chat.status_code == 200, r_chat.get_data(as_text=True)
print("LoopBot Chat OK:", r_chat.get_json().get("reply", "")[:60], "...")

r_vision = client.post(
    "/api/ai/vision-inspect",
    headers=student_auth,
    data={"photo": (io.BytesIO(b"dummy image bytes"), "item_photo.png")},
    content_type="multipart/form-data"
)
assert r_vision.status_code == 200, r_vision.get_data(as_text=True)
print("AI Vision Inspector OK:", r_vision.get_json().get("verdict"))

print("\n🎉 ALL TESTS PASSED WITH 100% SUCCESS! 🎉")
