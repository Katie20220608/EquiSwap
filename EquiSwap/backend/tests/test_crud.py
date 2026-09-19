def register_and_login(client, name: str, email: str, password: str) -> str:
    register_res = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert register_res.status_code == 201

    login_res = client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


def test_users_items_wishlists_crud_flow(client):
    token = register_and_login(client, "Alice", "alice@example.com", "password123")
    headers = {"Authorization": f"Bearer {token}"}

    users_res = client.get("/users/", headers=headers)
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) == 1
    user_id = users[0]["user_id"]

    update_user_res = client.put(f"/users/{user_id}", json={"name": "Alice Updated"}, headers=headers)
    assert update_user_res.status_code == 200
    assert update_user_res.json()["name"] == "Alice Updated"

    create_item_res = client.post(
        "/items/",
        json={
            "name": "Kids bike",
            "description": "Small bike in good condition",
            "condition_score": 8,
            "status": "available",
        },
        headers=headers,
    )
    assert create_item_res.status_code == 201
    item_id = create_item_res.json()["item_id"]

    list_items_res = client.get("/items/")
    assert list_items_res.status_code == 200
    assert len(list_items_res.json()) == 1

    update_item_res = client.put(f"/items/{item_id}", json={"status": "swap_pending"}, headers=headers)
    assert update_item_res.status_code == 200
    assert update_item_res.json()["status"] == "swap_pending"

    create_wishlist_res = client.post("/wishlists/", json={"item_id": item_id}, headers=headers)
    assert create_wishlist_res.status_code == 201
    wishlist_id = create_wishlist_res.json()["wishlist_id"]

    list_wishlist_res = client.get("/wishlists/", headers=headers)
    assert list_wishlist_res.status_code == 200
    assert len(list_wishlist_res.json()) == 1

    delete_wishlist_res = client.delete(f"/wishlists/{wishlist_id}", headers=headers)
    assert delete_wishlist_res.status_code == 204

    delete_item_res = client.delete(f"/items/{item_id}", headers=headers)
    assert delete_item_res.status_code == 204

    delete_user_res = client.delete(f"/users/{user_id}", headers=headers)
    assert delete_user_res.status_code == 204


def test_get_trust_score(client):
    token = register_and_login(client, "Dana", "dana@example.com", "password123")
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/users/", headers=headers).json()[0]["user_id"]

    res = client.get(f"/users/{user_id}/trust", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == user_id
    assert data["trust_score"] == 100
    assert data["rejection_count"] == 0
    assert data["history"] == []


def test_get_trust_score_requires_auth(client):
    token = register_and_login(client, "Eli", "eli@example.com", "password123")
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/users/", headers=headers).json()[0]["user_id"]

    res = client.get(f"/users/{user_id}/trust")
    assert res.status_code == 401


def test_get_trust_score_not_found(client):
    token = register_and_login(client, "Fay", "fay@example.com", "password123")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/users/9999/trust", headers=headers)
    assert res.status_code == 404
