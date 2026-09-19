"""Integration tests for GET/POST/DELETE /preferences (blacklist management)."""


def _register_login(client, name: str, email: str, password: str = "password123") -> tuple[str, int]:
    client.post("/auth/register", json={"name": name, "email": email, "password": password})
    token = client.post("/auth/login", data={"username": email, "password": password}).json()["access_token"]
    user_id = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["user_id"]
    return token, user_id


def test_list_requires_authentication(client):
    res = client.get("/preferences/")
    assert res.status_code == 401


def test_create_and_list_preference(client):
    token_a, _ = _register_login(client, "Alice", "alice@example.com")
    _, uid_b = _register_login(client, "Bob", "bob@example.com")

    res = client.post(
        "/preferences/",
        json={"avoid_user_id": uid_b, "reason": "Bad experience"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["avoid_user_id"] == uid_b
    assert body["avoid_user_name"] == "Bob"
    assert body["reason"] == "Bad experience"

    res = client.get("/preferences/", headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_cannot_blacklist_self(client):
    token_a, uid_a = _register_login(client, "Alice", "alice@example.com")

    res = client.post(
        "/preferences/",
        json={"avoid_user_id": uid_a},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 400


def test_cannot_blacklist_nonexistent_user(client):
    token_a, _ = _register_login(client, "Alice", "alice@example.com")

    res = client.post(
        "/preferences/",
        json={"avoid_user_id": 99999},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 404


def test_duplicate_preference_rejected(client):
    token_a, _ = _register_login(client, "Alice", "alice@example.com")
    _, uid_b = _register_login(client, "Bob", "bob@example.com")

    client.post(
        "/preferences/",
        json={"avoid_user_id": uid_b},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    res = client.post(
        "/preferences/",
        json={"avoid_user_id": uid_b},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 400


def test_delete_preference(client):
    token_a, _ = _register_login(client, "Alice", "alice@example.com")
    _, uid_b = _register_login(client, "Bob", "bob@example.com")

    created = client.post(
        "/preferences/",
        json={"avoid_user_id": uid_b},
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()

    res = client.delete(
        f"/preferences/{created['uf_id']}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 204

    res = client.get("/preferences/", headers={"Authorization": f"Bearer {token_a}"})
    assert res.json() == []


def test_cannot_delete_other_users_preference(client):
    token_a, _ = _register_login(client, "Alice", "alice@example.com")
    token_b, uid_b = _register_login(client, "Bob", "bob@example.com")
    _, uid_c = _register_login(client, "Carol", "carol@example.com")

    created = client.post(
        "/preferences/",
        json={"avoid_user_id": uid_c},
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()

    res = client.delete(
        f"/preferences/{created['uf_id']}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res.status_code == 403


def test_delete_nonexistent_preference(client):
    token_a, _ = _register_login(client, "Alice", "alice@example.com")

    res = client.delete(
        "/preferences/99999",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 404


def test_blacklisted_user_excluded_from_swap_cycles(client):
    token_a, uid_a = _register_login(client, "Alice", "alice@example.com")
    token_b, uid_b = _register_login(client, "Bob", "bob@example.com")

    item_a = client.post(
        "/items/",
        json={"name": "Alice's toy", "condition_score": 7, "status": "available"},
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()["item_id"]
    item_b = client.post(
        "/items/",
        json={"name": "Bob's bike", "condition_score": 7, "status": "available"},
        headers={"Authorization": f"Bearer {token_b}"},
    ).json()["item_id"]

    client.post("/wishlists/", json={"item_id": item_b}, headers={"Authorization": f"Bearer {token_a}"})
    client.post("/wishlists/", json={"item_id": item_a}, headers={"Authorization": f"Bearer {token_b}"})

    res = client.get(f"/swaps/find/{uid_a}", headers={"Authorization": f"Bearer {token_a}"})
    assert len(res.json()["cycles"]) == 1

    client.post(
        "/preferences/",
        json={"avoid_user_id": uid_b},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    res = client.get(f"/swaps/find/{uid_a}", headers={"Authorization": f"Bearer {token_a}"})
    assert res.json()["cycles"] == []
