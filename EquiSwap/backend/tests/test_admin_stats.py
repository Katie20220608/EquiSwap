from app import models
from tests.conftest import TestingSessionLocal


def _login(client, name, email):
    client.post("/auth/register", json={"name": name, "email": email, "password": "password123"})
    token = client.post("/auth/login", data={"username": email, "password": "password123"}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


def test_stats_requires_admin(client):
    headers = _login(client, "Pat", "pat@example.com")
    assert client.get("/admin/stats", headers=headers).status_code == 403


def test_stats_counts(client):
    headers = _login(client, "Root", "root@example.com")
    with TestingSessionLocal() as db:
        db.query(models.User).update({"role": "admin"})
        cat = models.Category(c_name="Toys")
        db.add(cat)
        db.flush()
        db.add_all([models.Item(owner_id=1, name="Car", category_id=cat.c_id, status="available")])
        db.commit()

    res = client.get("/admin/stats", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total_users"] == 1
    assert body["new_users_7d"] == 1
    assert body["total_items"] == 1
    assert body["available_items"] == 1
    assert body["completed_swaps"] == 0
    assert len(body["signups_per_day"]) == 14
    assert sum(d["count"] for d in body["signups_per_day"]) == 1
    assert body["top_categories"][0]["category"] == "Toys"


def _admin(client):
    headers = _login(client, "Root", "root@example.com")
    with TestingSessionLocal() as db:
        db.query(models.User).update({"role": "admin"})
        db.commit()
    return headers


def test_user_search_filter_and_suspend(client):
    headers = _admin(client)
    _login(client, "Noah Lee", "noah@example.com")
    _login(client, "Ivy", "ivy@example.com")

    res = client.get("/admin/users", params={"q": "noah"}, headers=headers)
    assert [u["name"] for u in res.json()] == ["Noah Lee"]

    res = client.patch("/admin/users/2/status", json={"is_active": False}, headers=headers)
    assert res.status_code == 200 and res.json()["is_active"] is False

    res = client.get("/admin/users", params={"status": "suspended"}, headers=headers)
    assert [u["user_id"] for u in res.json()] == [2]
    assert len(client.get("/admin/users", params={"role": "admin"}, headers=headers).json()) == 1

    login = client.post("/auth/login", data={"username": "noah@example.com", "password": "password123"})
    assert login.status_code == 403

    client.patch("/admin/users/2/status", json={"is_active": True}, headers=headers)
    login = client.post("/auth/login", data={"username": "noah@example.com", "password": "password123"})
    assert login.status_code == 200


def test_cannot_suspend_self_or_missing(client):
    headers = _admin(client)
    assert (
        client.patch("/admin/users/1/status", json={"is_active": False}, headers=headers).status_code == 400
    )
    assert (
        client.patch("/admin/users/99/status", json={"is_active": False}, headers=headers).status_code == 404
    )


def test_suspended_token_rejected(client):
    headers = _admin(client)
    member = _login(client, "Noah", "noah@example.com")
    client.patch("/admin/users/2/status", json={"is_active": False}, headers=headers)
    assert client.get("/auth/me", headers=member).status_code == 403


def test_user_detail(client):
    headers = _admin(client)
    _login(client, "Noah", "noah@example.com")
    res = client.get("/admin/users/2", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["name"] == "Noah"
    assert body["swap_counts"] == {"given": 0, "received": 0, "completed": 0, "rejected": 0}
    assert client.get("/admin/users/99", headers=headers).status_code == 404


def test_swap_insights(client):
    import uuid

    headers = _admin(client)
    _login(client, "A", "a@example.com")
    _login(client, "B", "b@example.com")
    done, rej = uuid.uuid4(), uuid.uuid4()
    with TestingSessionLocal() as db:
        db.add_all([models.Item(owner_id=i, name=f"i{i}") for i in (1, 2, 3)])
        db.flush()
        for cid, status, reason in ((done, "accepted", None), (rej, "rejected", "Too far")):
            db.add(
                models.SwapProposal(
                    cycle_id=cid, giver_id=1, receiver_id=2, item_id=1, status=status, rejection_reason=reason
                )
            )
            db.add(models.SwapProposal(cycle_id=cid, giver_id=2, receiver_id=1, item_id=2, status="accepted"))
        db.commit()

    body = client.get("/admin/swap-insights", headers=headers).json()
    assert body["total_cycles"] == 2
    assert body["completed_cycles"] == 1
    assert body["success_rate"] == 0.5
    assert body["by_length"] == [{"length": 2, "total": 2, "completed": 1, "success_rate": 0.5}]
    assert body["top_rejection_reasons"] == [{"reason": "Too far", "count": 1}]
    assert body["outcome_counts"] == {"completed": 1, "rejected": 1}
