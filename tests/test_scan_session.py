"""
Comprehensive Test Suite for Multi-Angle Package Scanning Sessions
Validates:
1. Session lifecycle:
   - Create session with one image
   - Add another image using session_id
   - Verify viewsCaptured increases
   - Verify sessionId remains the same
   - Verify mergedCoverage contains found, missing, hintLine, allFound
   - Verify quality is returned
2. Finalization:
   - Create session with multiple views
   - Finalize it
   - Verify HTTP 200
   - Verify id, status, and fields exist
   - Verify facesScanned equals number of views
   - Verify imageUris is a list
   - Verify exactly ONE ScanRecordDB is created
   - Verify session no longer exists after successful finalization
   - Verify a second finalize returns 404
3. Discard:
   - Create session
   - DELETE it -> HTTP 204
   - DELETE same session again -> HTTP 204 (idempotent)
   - Verify no database record is created
4. Validation:
   - Reject more than 6 images (HTTP 400)
   - Reject invalid image formats (HTTP 400)
   - Handle expired sessions (HTTP 404)
   - Handle invalid session IDs (HTTP 404)
5. Session management:
   - Verify 15-minute TTL
   - Verify 20-session capacity
   - Verify oldest session is evicted
   - Verify temporary files are cleaned on eviction/discard
6. Merge correctness:
   - Verify field missing from view 1 but found in view 2 appears correctly in merged result
"""

import os
import uuid
import cv2
import time
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from core.database import SessionLocal, create_tables
from core.db_models import ScanRecordDB
from core.config import UPLOAD_DIR
from app.routers.scan_session import (
    session_store,
    MAX_ACTIVE_SESSIONS,
    SESSION_TTL_SECONDS,
    ScanView,
)
import app.routers.scan_session as scan_session_module


@pytest.fixture(scope="module")
def client():
    create_tables()
    return TestClient(app)


@pytest.fixture(scope="module")
def auth_headers(client):
    username = f"officer_{np.random.randint(10000, 99999)}"
    password = "SecurePassword123!"
    client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_test_image(text: str = "MRP Rs. 250 Net Wt: 500 g") -> bytes:
    img = np.zeros((200, 450, 3), dtype=np.uint8)
    cv2.putText(img, text, (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    _, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes()


# =============================================================================
# 1. Session Lifecycle Tests
# =============================================================================

def test_session_lifecycle(client):
    """
    - Create a session with one image.
    - Add another image using session_id.
    - Verify viewsCaptured increases.
    - Verify sessionId remains the same.
    - Verify mergedCoverage contains found, missing, hintLine and allFound.
    - Verify quality is returned.
    """
    img1 = _create_test_image("Angle 1 Test")
    img2 = _create_test_image("Angle 2 Test")

    # Step 1: Create session with one image
    resp1 = client.post(
        "/api/scan/session",
        files=[("images", ("angle1.jpg", img1, "image/jpeg"))],
    )
    assert resp1.status_code == 200
    data1 = resp1.json()

    assert "sessionId" in data1
    session_id = data1["sessionId"]
    assert data1["viewsCaptured"] == 1
    assert "mergedCoverage" in data1
    cov1 = data1["mergedCoverage"]
    assert "found" in cov1
    assert "missing" in cov1
    assert "hintLine" in cov1
    assert "allFound" in cov1
    assert "quality" in data1
    assert "averageSharpness" in data1["quality"]

    # Step 2: Add another image using session_id
    resp2 = client.post(
        "/api/scan/session",
        files=[("images", ("angle2.jpg", img2, "image/jpeg"))],
        data={"session_id": session_id},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()

    # Verify sessionId remains the same
    assert data2["sessionId"] == session_id
    # Verify viewsCaptured increases
    assert data2["viewsCaptured"] == 2
    # Verify mergedCoverage structure
    cov2 = data2["mergedCoverage"]
    assert isinstance(cov2["found"], list)
    assert isinstance(cov2["missing"], list)
    assert isinstance(cov2["hintLine"], str)
    assert isinstance(cov2["allFound"], bool)
    # Verify quality structure
    assert "quality" in data2
    assert "averageSharpness" in data2["quality"]
    assert "isAcceptable" in data2["quality"]


# =============================================================================
# 2. Finalization Tests
# =============================================================================

def test_session_finalization(client, auth_headers):
    """
    - Create a session with multiple views.
    - Finalize it.
    - Verify HTTP 200.
    - Verify id, status and fields exist.
    - Verify facesScanned equals the number of views.
    - Verify imageUris is a list.
    - Verify exactly ONE ScanRecordDB is created.
    - Verify the session no longer exists after successful finalization.
    - Verify a second finalize returns 404.
    """
    img1 = _create_test_image("Angle A")
    img2 = _create_test_image("Angle B")

    # Create session with 2 views
    resp = client.post(
        "/api/scan/session",
        files=[
            ("images", ("view_a.jpg", img1, "image/jpeg")),
            ("images", ("view_b.jpg", img2, "image/jpeg")),
        ],
    )
    assert resp.status_code == 200
    session_id = resp.json()["sessionId"]
    assert resp.json()["viewsCaptured"] == 2

    # Finalize session
    final_resp = client.post(
        f"/api/scan/session/{session_id}/finalize",
        headers=auth_headers,
    )
    # Verify HTTP 200
    assert final_resp.status_code == 200
    final_data = final_resp.json()

    # Verify id, status, and fields exist
    assert "id" in final_data
    scan_id = final_data["id"]
    assert "status" in final_data
    assert "fields" in final_data

    # Verify facesScanned equals the number of views
    assert "facesScanned" in final_data
    assert len(final_data["facesScanned"]) == 2

    # Verify imageUris is a list
    assert "imageUris" in final_data
    assert isinstance(final_data["imageUris"], list)
    assert len(final_data["imageUris"]) == 2

    # Verify exactly ONE ScanRecordDB is created
    db = SessionLocal()
    try:
        matching_records = db.query(ScanRecordDB).filter(ScanRecordDB.id == scan_id).all()
        assert len(matching_records) == 1
    finally:
        db.close()

    # Verify the session no longer exists after successful finalization
    assert session_store.get(session_id) is None

    # Verify a second finalize returns 404
    second_final = client.post(
        f"/api/scan/session/{session_id}/finalize",
        headers=auth_headers,
    )
    assert second_final.status_code == 404


# =============================================================================
# 3. Discard Tests
# =============================================================================

def test_session_discard(client):
    """
    - Create a session.
    - DELETE it.
    - Verify HTTP 204.
    - DELETE the same session again.
    - Verify it remains idempotent and does not create a database record.
    """
    img = _create_test_image("Discard Test")
    create_resp = client.post(
        "/api/scan/session",
        files=[("images", ("discard_view.jpg", img, "image/jpeg"))],
    )
    assert create_resp.status_code == 200
    session_id = create_resp.json()["sessionId"]

    # Session exists in store
    assert session_store.get(session_id) is not None

    # DELETE it -> Verify HTTP 204
    del_resp1 = client.delete(f"/api/scan/session/{session_id}")
    assert del_resp1.status_code == 204

    # Session no longer exists in store
    assert session_store.get(session_id) is None

    # DELETE the same session again -> Verify it remains idempotent (HTTP 204)
    del_resp2 = client.delete(f"/api/scan/session/{session_id}")
    assert del_resp2.status_code == 204

    # Verify NO database record is created
    db = SessionLocal()
    try:
        record = db.query(ScanRecordDB).filter(ScanRecordDB.id == session_id).first()
        assert record is None
    finally:
        db.close()


# =============================================================================
# 4. Validation Tests
# =============================================================================

def test_validation_errors(client):
    """
    - Reject more than 6 images.
    - Reject invalid image formats.
    - Handle expired sessions.
    - Handle invalid session IDs.
    """
    img_bytes = _create_test_image("Test")

    # Reject more than 6 images
    seven_images = [("images", (f"img_{i}.jpg", img_bytes, "image/jpeg")) for i in range(7)]
    resp_too_many = client.post("/api/scan/session", files=seven_images)
    assert resp_too_many.status_code == 400
    assert "Maximum 6 images" in resp_too_many.json()["detail"]

    # Reject invalid image formats
    bad_file = ("bad.txt", b"plain text header", "text/plain")
    resp_bad_fmt = client.post("/api/scan/session", files=[("images", bad_file)])
    assert resp_bad_fmt.status_code == 400
    assert "Invalid image format" in resp_bad_fmt.json()["detail"]

    # Handle invalid session IDs
    resp_invalid_sess = client.post(
        "/api/scan/session",
        files=[("images", ("valid.jpg", img_bytes, "image/jpeg"))],
        data={"session_id": "non_existent_session_id_12345"},
    )
    assert resp_invalid_sess.status_code == 404
    assert "not found" in resp_invalid_sess.json()["detail"].lower()

    # Handle expired sessions
    expired_sess = session_store.create(session_id="expired_sess_test_123")
    expired_sess.last_accessed_at = time.time() - (SESSION_TTL_SECONDS + 10)
    resp_expired = client.post(
        "/api/scan/session",
        files=[("images", ("valid.jpg", img_bytes, "image/jpeg"))],
        data={"session_id": "expired_sess_test_123"},
    )
    assert resp_expired.status_code == 404


# =============================================================================
# 5. Session Management Tests
# =============================================================================

def test_session_management_ttl_capacity_and_cleanup():
    """
    - Verify 15-minute TTL.
    - Verify 20-session capacity.
    - Verify oldest session is evicted.
    - Verify temporary files are cleaned.
    """
    # 1. Verify 15-minute TTL
    test_sess_id = f"ttl_check_{time.time()}"
    sess = session_store.create(session_id=test_sess_id)
    assert session_store.get(test_sess_id) is not None

    # Age past 15 min
    sess.last_accessed_at = time.time() - (SESSION_TTL_SECONDS + 1)
    assert session_store.get(test_sess_id) is None

    # 2. Verify temporary files are cleaned upon eviction and discard
    dummy_file = os.path.join(UPLOAD_DIR, f"temp_clean_test_{uuid.uuid4().hex[:6]}.jpg")
    with open(dummy_file, "wb") as f:
        f.write(b"dummy image data")
    assert os.path.exists(dummy_file)

    clean_sess = session_store.create(session_id="temp_clean_session")
    clean_sess.views.append(
        ScanView(
            view_id="view_clean_1",
            image_path=dummy_file,
            annotated_path=dummy_file,
            pipeline_report={},
            quality={},
            elapsed_seconds=0.1,
        )
    )
    # Discarding session deletes temporary files
    session_store.remove("temp_clean_session", delete_files=True)
    assert not os.path.exists(dummy_file)

    # 3. Verify 20-session capacity and LRU oldest eviction
    created_sessions = []
    for i in range(MAX_ACTIVE_SESSIONS + 3):
        sid = f"cap_sess_{i}_{time.time()}"
        s = session_store.create(session_id=sid)
        created_sessions.append(sid)
        time.sleep(0.01)

    # Capacity must not exceed MAX_ACTIVE_SESSIONS (20)
    assert session_store.count() <= MAX_ACTIVE_SESSIONS
    # Oldest session should be evicted
    assert session_store.get(created_sessions[0]) is None


# =============================================================================
# 6. Merge Correctness Tests
# =============================================================================

def test_merge_correctness_field_missing_view1_found_view2(client, monkeypatch):
    """
    - Verify that a field missing from view 1 but found in view 2
      appears correctly in the merged result.
    """
    call_index = {"count": 0}

    def mock_ensemble_scan(image_path: str, **kwargs):
        call_index["count"] += 1
        if call_index["count"] == 1:
            # View 1: Net quantity is found, MRP is MISSING
            return {
                "overall_status": "NON-COMPLIANT",
                "compliance_score": 12.5,
                "elapsed_seconds": 0.2,
                "fields": {
                    "net_quantity": {
                        "found": True,
                        "value": "250 g",
                        "confidence": 0.94,
                        "label": "Net Quantity",
                        "rule": "LM Rule §6(1)(c)",
                        "source": "paddleocr",
                    },
                    "mrp": {
                        "found": False,
                        "value": None,
                        "confidence": 0.0,
                        "label": "Maximum Retail Price (MRP)",
                        "rule": "LM Rule §6(1)(e)",
                    },
                },
                "user_instructions": [],
            }
        else:
            # View 2: MRP is FOUND
            return {
                "overall_status": "NON-COMPLIANT",
                "compliance_score": 25.0,
                "elapsed_seconds": 0.2,
                "fields": {
                    "mrp": {
                        "found": True,
                        "value": "Rs. 95.00",
                        "confidence": 0.91,
                        "label": "Maximum Retail Price (MRP)",
                        "rule": "LM Rule §6(1)(e)",
                        "source": "paddleocr",
                    },
                },
                "user_instructions": [],
            }

    monkeypatch.setattr(scan_session_module, "ensemble_scan", mock_ensemble_scan)

    img = _create_test_image("Merge Test Image")

    # Upload View 1
    resp1 = client.post(
        "/api/scan/session",
        files=[("images", ("panel_front.jpg", img, "image/jpeg"))],
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    session_id = data1["sessionId"]

    # In View 1, net_quantity is found, mrp is missing
    assert "net_quantity" in data1["mergedCoverage"]["found"]
    assert "mrp" in data1["mergedCoverage"]["missing"]
    assert data1["fields"]["net_quantity"]["found"] is True
    assert data1["fields"]["mrp"]["found"] is False

    # Upload View 2 to the same session
    resp2 = client.post(
        "/api/scan/session",
        files=[("images", ("panel_bottom.jpg", img, "image/jpeg"))],
        data={"session_id": session_id},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()

    # In merged result after View 2, mrp is now FOUND!
    assert "net_quantity" in data2["mergedCoverage"]["found"]
    assert "mrp" in data2["mergedCoverage"]["found"]
    assert data2["fields"]["mrp"]["found"] is True
    assert data2["fields"]["mrp"]["value"] == "Rs. 95.00"
    assert data2["fields"]["net_quantity"]["found"] is True
    assert data2["fields"]["net_quantity"]["value"] == "250 g"
