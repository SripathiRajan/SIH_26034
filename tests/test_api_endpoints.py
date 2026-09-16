"""
Integration Tests for FastAPI Endpoints
Covers: Health, Auth (Register, Login, Me), Products (CRUD), Analyze (with optional GTIN),
Scans (List, Detail, Delete), PDF Report Export, Stats & Analytics, Chat RAG, and Offline Sync.
"""

import io
import base64
import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient
from app.main import app
from core.database import SessionLocal
from core.db_models import UserDB, ScanRecordDB, ProductMasterDB


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def _generate_test_image_bytes(text: str = "MRP Rs. 299 (incl. of all taxes) Net Wt: 500 g") -> bytes:
    img = np.zeros((200, 400, 3), dtype=np.uint8)
    cv2.putText(img, text, (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    _, encoded = cv2.imencode(".jpg", img)
    return encoded.tobytes()


# =============================================================================
# 1. Health Endpoint Test
# =============================================================================

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "ocr_engines" in data
    assert data["ocr_engines"]["tertiary"] == "surya"


# =============================================================================
# 2. Authentication Flow Tests
# =============================================================================

def test_auth_registration_login_and_me(client):
    username = f"inspector_test_{np.random.randint(1000, 9999)}"
    password = "SecurePassword123!"

    # 1. Register
    reg_resp = client.post(
        "/api/auth/register",
        json={"username": username, "password": password, "role": "inspector"},
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert reg_data["username"] == username
    assert reg_data["role"] == "inspector"

    # 2. Duplicate registration should fail
    dup_resp = client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )
    assert dup_resp.status_code == 400

    # 3. Login
    login_resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"
    token = login_data["access_token"]

    # 4. Access Protected Route /api/auth/me
    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["username"] == username
    assert me_data["role"] == "inspector"


# =============================================================================
# 3. Product Master Catalog Tests
# =============================================================================

def test_product_master_upsert_and_lookup(client):
    gtin = f"890123{np.random.randint(100000, 999999)}"

    # 1. Upsert product
    post_resp = client.post(
        "/api/products",
        json={
            "gtin": gtin,
            "brand": "Britannia",
            "productName": "Good Day Butter Cookies 200g",
            "category": "Biscuits & Confectionery",
            "standardNetQuantity": "200 g",
            "expectedMrpMin": 40.0,
            "expectedMrpMax": 50.0,
        },
    )
    assert post_resp.status_code == 201
    assert post_resp.json()["gtin"] == gtin

    # 2. Lookup product
    get_resp = client.get(f"/api/products/{gtin}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["brand"] == "Britannia"
    assert data["productName"] == "Good Day Butter Cookies 200g"


# =============================================================================
# 4. Scan & Analyze Endpoint Tests (with optional GTIN)
# =============================================================================

def test_analyze_endpoint_with_gtin(client):
    img_bytes = _generate_test_image_bytes("MRP Rs. 120.00 (incl of all taxes) Net Wt: 200 g")
    gtin = "8901030000001"

    # Seed product master
    client.post(
        "/api/products",
        json={
            "gtin": gtin,
            "brand": "Britannia",
            "productName": "NutriChoice Digestive",
            "category": "Cookies",
            "standardNetQuantity": "200 g",
            "expectedMrpMin": 110.0,
            "expectedMrpMax": 130.0,
        },
    )

    response = client.post(
        "/api/analyze",
        files={"image": ("label_burst.jpg", img_bytes, "image/jpeg")},
        data={"gtin": gtin, "use_ensemble": "false"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["gtin"] == gtin
    assert data["brand"] == "Britannia"
    assert "fields" in data
    assert len(data["fields"]) > 0


# =============================================================================
# 5. Scans Persistence & CRUD Tests
# =============================================================================

def test_scans_list_detail_and_delete(client):
    img_bytes = _generate_test_image_bytes()
    analyze_resp = client.post(
        "/api/analyze",
        files={"image": ("test_frame.jpg", img_bytes, "image/jpeg")},
    )
    assert analyze_resp.status_code == 200
    scan_id = analyze_resp.json()["id"]

    # 1. List scans
    list_resp = client.get("/api/scans?limit=10&offset=0")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total"] >= 1
    found = any(s["id"] == scan_id for s in list_data["items"])
    assert found is True

    # 2. Detail scan
    detail_resp = client.get(f"/api/scans/{scan_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == scan_id

    # 3. Delete scan
    del_resp = client.delete(f"/api/scans/{scan_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"

    # 4. Detail should now return 404
    detail_after = client.get(f"/api/scans/{scan_id}")
    assert detail_after.status_code == 404


# =============================================================================
# 6. PDF Audit Report Export Test
# =============================================================================

def test_export_pdf_report(client):
    img_bytes = _generate_test_image_bytes("MRP Rs. 50 (incl. of all taxes) Net Qty: 100 g")
    analyze_resp = client.post(
        "/api/analyze",
        files={"image": ("pdf_test.jpg", img_bytes, "image/jpeg")},
    )
    assert analyze_resp.status_code == 200
    scan_id = analyze_resp.json()["id"]

    pdf_resp = client.get(f"/api/scans/{scan_id}/report.pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert "attachment" in pdf_resp.headers["content-disposition"]
    # PDF magic bytes
    assert pdf_resp.content.startswith(b"%PDF")


# =============================================================================
# 7. Compliance Stats & Analytics Test
# =============================================================================

def test_compliance_stats(client):
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "totalScans" in data
    assert "statusCounts" in data
    assert "pass" in data["statusCounts"]
    assert "needs_review" in data["statusCounts"]
    assert "complianceRatePercent" in data
    assert "violationsByField" in data
    assert "recentScans" in data


# =============================================================================
# 8. Offline Synchronization Test
# =============================================================================

def test_offline_sync_endpoint(client):
    img_bytes = _generate_test_image_bytes("MRP Rs. 80 Net Qty: 250 g")
    b64_img = base64.b64encode(img_bytes).decode("utf-8")

    sync_payload = {
        "deviceId": "test-device-uuid-999",
        "scans": [
            {
                "clientScanId": "client_scan_001",
                "timestamp": "2026-09-14T19:00:00Z",
                "gtin": "8901234567890",
                "imageBase64": f"data:image/jpeg;base64,{b64_img}",
            }
        ],
    }

    response = client.post("/api/scans/sync", json=sync_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["deviceId"] == "test-device-uuid-999"
    assert data["syncedCount"] == 1
    assert "client_scan_001" in data["syncedClientIds"]
    assert len(data["results"]) == 1
    assert "id" in data["results"][0]


# =============================================================================
# 9. Compliance RAG Chatbot Test
# =============================================================================

def test_chat_compliance_assistant(client):
    response = client.post(
        "/api/chat",
        json={"message": "What is the rule regarding Maximum Retail Price (MRP) and taxes?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "citations" in data
    assert "timestamp" in data
