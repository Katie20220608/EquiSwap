import logging

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_release_info(monkeypatch):
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abc123")
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["version"] == "abc123"
    assert "environment" in body


def test_responses_carry_a_request_id():
    response = client.get("/health")
    assert response.headers["x-request-id"]
    echoed = client.get("/health", headers={"X-Request-ID": "trace-1"})
    assert echoed.headers["x-request-id"] == "trace-1"


def test_client_error_is_logged(caplog):
    with caplog.at_level(logging.ERROR, logger="equiswap"):
        response = client.post(
            "/client-errors",
            json={"message": "boom", "stack": "at x", "url": "http://x/", "context": {"source": "test"}},
        )
    assert response.status_code == 204
    assert "client_error" in caplog.text and "boom" in caplog.text


def test_client_error_rejects_oversized_payload():
    assert client.post("/client-errors", json={"message": "x" * 501}).status_code == 422


def test_unhandled_errors_return_request_id():
    @app.get("/__boom")
    def boom():
        raise RuntimeError("nope")

    response = TestClient(app, raise_server_exceptions=False).get("/__boom")
    assert response.status_code == 500
    assert response.json()["request_id"] == response.headers["x-request-id"]
