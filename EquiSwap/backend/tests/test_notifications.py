"""Integration tests for GET/PATCH /notifications endpoints."""

import pytest


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
    """Set up a valid 2-user cycle and return tokens/ids."""
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


def test_propose_creates_a_notification_for_each_participant(client, two_user_cycle):
    ctx = two_user_cycle
    _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])

    for token in (ctx["token_a"], ctx["token_b"]):
        res = client.get("/notifications/", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        notifications = res.json()
        assert len(notifications) == 1
        assert notifications[0]["type"] == "swap_proposal"
        assert notifications[0]["is_read"] is False


def test_list_requires_authentication(client):
    res = client.get("/notifications/")
    assert res.status_code == 401


def test_unread_only_filter(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])

    # Mark Alice's only notification as read
    n_id = client.get("/notifications/", headers={"Authorization": f"Bearer {ctx['token_a']}"}).json()[0][
        "n_id"
    ]
    client.patch(
        f"/notifications/{n_id}/read",
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )

    # Rejecting creates a second notification for Alice (none, since she's the rejector)
    # but Bob gets a new "swap_response" notification -> now has 2 total, 2 unread
    client.patch(
        f"/swaps/{sp_a['sp_id']}/respond",
        json={"decision": "rejected"},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )

    res = client.get(
        "/notifications/?unread_only=true",
        headers={"Authorization": f"Bearer {ctx['token_b']}"},
    )
    assert res.status_code == 200
    unread = res.json()
    assert len(unread) == 2
    assert {n["type"] for n in unread} == {"swap_proposal", "swap_response"}


def test_unread_count(client, two_user_cycle):
    ctx = two_user_cycle
    _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])

    res = client.get("/notifications/unread-count", headers={"Authorization": f"Bearer {ctx['token_a']}"})
    assert res.status_code == 200
    assert res.json()["unread_count"] == 1


def test_mark_notification_read(client, two_user_cycle):
    ctx = two_user_cycle
    _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])

    n_id = client.get("/notifications/", headers={"Authorization": f"Bearer {ctx['token_a']}"}).json()[0][
        "n_id"
    ]

    res = client.patch(
        f"/notifications/{n_id}/read",
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 200
    assert res.json()["is_read"] is True

    res = client.get("/notifications/unread-count", headers={"Authorization": f"Bearer {ctx['token_a']}"})
    assert res.json()["unread_count"] == 0


def test_cannot_mark_other_users_notification_read(client, two_user_cycle):
    ctx = two_user_cycle
    _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])

    n_id = client.get("/notifications/", headers={"Authorization": f"Bearer {ctx['token_a']}"}).json()[0][
        "n_id"
    ]

    res = client.patch(
        f"/notifications/{n_id}/read",
        headers={"Authorization": f"Bearer {ctx['token_b']}"},
    )
    assert res.status_code == 403


def test_mark_read_nonexistent_notification(client, two_user_cycle):
    ctx = two_user_cycle
    res = client.patch(
        "/notifications/99999/read",
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 404


def test_mark_all_read(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    sp_b = next(p for p in proposals if p["giver_id"] == ctx["uid_b"])

    # Bob accepts, which doesn't complete the swap yet, but Alice already has
    # one notification. Reject via Bob to generate a second notification for Alice.
    client.patch(
        f"/swaps/{sp_b['sp_id']}/respond",
        json={"decision": "rejected"},
        headers={"Authorization": f"Bearer {ctx['token_b']}"},
    )

    res = client.patch("/notifications/read-all", headers={"Authorization": f"Bearer {ctx['token_a']}"})
    assert res.status_code == 200
    assert res.json()["updated"] == 2

    res = client.get("/notifications/unread-count", headers={"Authorization": f"Bearer {ctx['token_a']}"})
    assert res.json()["unread_count"] == 0
