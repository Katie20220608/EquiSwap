"""Unit/integration tests for the swap proposal expiration sweep."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app import models
from app.routers.swaps import process_expirations


def _register_login(client, name: str, email: str, password: str = "password123") -> tuple[str, int]:
    client.post("/auth/register", json={"name": name, "email": email, "password": password})
    token = client.post("/auth/login", data={"username": email, "password": password}).json()["access_token"]
    user_id = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["user_id"]
    return token, user_id


def _create_item(client, token: str, name: str) -> int:
    res = client.post(
        "/items/",
        json={"name": name, "condition_score": 7, "status": "available"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["item_id"]


def _add_wishlist(client, token: str, item_id: int) -> None:
    res = client.post(
        "/wishlists/",
        json={"item_id": item_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201


@pytest.fixture
def two_user_cycle(client):
    token_a, uid_a = _register_login(client, "Alice", "alice@example.com")
    token_b, uid_b = _register_login(client, "Bob", "bob@example.com")

    item_a = _create_item(client, token_a, "Alice's toy")
    item_b = _create_item(client, token_b, "Bob's bike")

    _add_wishlist(client, token_a, item_b)
    _add_wishlist(client, token_b, item_a)

    return {
        "token_a": token_a,
        "uid_a": uid_a,
        "item_a": item_a,
        "token_b": token_b,
        "uid_b": uid_b,
        "item_b": item_b,
    }


def _propose(client, token, user_ids) -> list:
    res = client.post(
        "/swaps/propose",
        json={"user_ids": user_ids},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.json()
    return res.json()


def _get_db_session():
    from tests.conftest import TestingSessionLocal

    return TestingSessionLocal()


def test_process_expirations_expires_overdue_and_frees_items(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    cycle_id = proposals[0]["cycle_id"]

    db = _get_db_session()
    try:
        db.query(models.SwapProposal).filter(models.SwapProposal.cycle_id == uuid.UUID(cycle_id)).update(
            {"expires_at": datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)}
        )
        db.commit()
        result = process_expirations(db)
    finally:
        db.close()

    assert result == {"expired_cycles": 1, "warnings_sent": 0}

    item_a = client.get(f"/items/{ctx['item_a']}").json()
    assert item_a["status"] == "available"

    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])
    fetched = client.get(
        f"/swaps/cycles/{cycle_id}", headers={"Authorization": f"Bearer {ctx['token_a']}"}
    ).json()
    # The proposal whose deadline passed becomes "expired"; its cycle sibling
    # is cancelled alongside it since the whole cycle can no longer complete.
    assert all(p["status"] in ("expired", "cancelled") for p in fetched)
    assert any(p["status"] == "expired" for p in fetched)
    assert sp_a  # sanity check the earlier lookup succeeded

    for token in (ctx["token_a"], ctx["token_b"]):
        notes = client.get("/notifications/", headers={"Authorization": f"Bearer {token}"}).json()
        assert any(n["type"] == "swap_expired" for n in notes)


def test_process_expirations_warns_when_close_to_expiry(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])

    db = _get_db_session()
    try:
        db.query(models.SwapProposal).filter(models.SwapProposal.sp_id == sp_a["sp_id"]).update(
            {"expires_at": datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=30)}
        )
        db.commit()
        result = process_expirations(db)
    finally:
        db.close()

    assert result == {"expired_cycles": 0, "warnings_sent": 1}

    notes_a = client.get("/notifications/", headers={"Authorization": f"Bearer {ctx['token_a']}"}).json()
    assert any(n["type"] == "swap_expiring_soon" for n in notes_a)

    # Proposal itself should remain pending, only flagged as warned
    proposal = client.get(
        f"/swaps/cycles/{proposals[0]['cycle_id']}",
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    ).json()
    assert next(p for p in proposal if p["sp_id"] == sp_a["sp_id"])["status"] == "pending"


def test_process_expirations_does_not_resend_warning(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])

    db = _get_db_session()
    try:
        db.query(models.SwapProposal).filter(models.SwapProposal.sp_id == sp_a["sp_id"]).update(
            {"expires_at": datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=30)}
        )
        db.commit()
        process_expirations(db)
    finally:
        db.close()

    db2 = _get_db_session()
    try:
        result = process_expirations(db2)
    finally:
        db2.close()

    assert result == {"expired_cycles": 0, "warnings_sent": 0}


def test_process_expirations_ignores_proposals_without_expiry_or_far_out(client, two_user_cycle):
    ctx = two_user_cycle
    _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])

    db = _get_db_session()
    try:
        result = process_expirations(db)
    finally:
        db.close()

    # expires_at defaults to +24h, well outside the 1h warning window
    assert result == {"expired_cycles": 0, "warnings_sent": 0}


def test_process_expirations_endpoint_is_reachable(client):
    res = client.post("/swaps/process-expirations")
    assert res.status_code == 200
    body = res.json()
    assert "expired_cycles" in body
    assert "warnings_sent" in body
