"""Additional coverage for POST /users/, GET /users/{id}, PUT, and DELETE edge cases."""


def register_and_login(client, name: str, email: str, password: str = "password123") -> str:
    client.post("/auth/register", json={"name": name, "email": email, "password": password})
    return client.post("/auth/login", data={"username": email, "password": password}).json()["access_token"]


def test_create_user_via_users_endpoint(client):
    res = client.post(
        "/users/", json={"name": "Gina", "email": "gina@example.com", "password": "password123"}
    )
    assert res.status_code == 201
    assert res.json()["email"] == "gina@example.com"


def test_create_user_duplicate_email_rejected(client):
    client.post("/users/", json={"name": "Gina", "email": "gina@example.com", "password": "password123"})
    res = client.post(
        "/users/", json={"name": "Gina2", "email": "gina@example.com", "password": "password123"}
    )
    assert res.status_code == 400


def test_get_user_by_id(client):
    token = register_and_login(client, "Hank", "hank@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    user_id = client.get("/users/", headers=headers).json()[0]["user_id"]

    res = client.get(f"/users/{user_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["user_id"] == user_id


def test_get_user_by_id_not_found(client):
    token = register_and_login(client, "Ivy", "ivy@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/users/9999", headers=headers)
    assert res.status_code == 404


def test_update_user_not_found(client):
    token = register_and_login(client, "Jill", "jill@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.put("/users/9999", json={"name": "Nope"}, headers=headers)
    assert res.status_code == 404


def test_update_other_users_profile_forbidden(client):
    token_a = register_and_login(client, "Kim", "kim@example.com")
    token_b = register_and_login(client, "Liam", "liam@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    user_id_a = client.get("/users/", headers=headers_a).json()[0]["user_id"]

    res = client.put(f"/users/{user_id_a}", json={"name": "Hacked"}, headers=headers_b)
    assert res.status_code == 403


def test_delete_user_not_found(client):
    token = register_and_login(client, "Mona", "mona@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.delete("/users/9999", headers=headers)
    assert res.status_code == 404


def test_delete_other_users_profile_forbidden(client):
    token_a = register_and_login(client, "Noah", "noah@example.com")
    token_b = register_and_login(client, "Olga", "olga@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    user_id_a = client.get("/users/", headers=headers_a).json()[0]["user_id"]

    res = client.delete(f"/users/{user_id_a}", headers=headers_b)
    assert res.status_code == 403


def test_user_can_change_password_after_verifying_current_password(client):
    token = register_and_login(client, "Pia", "pia@example.com", "old-password")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.patch(
        "/auth/password",
        json={"current_password": "old-password", "new_password": "new-password"},
        headers=headers,
    )
    assert res.status_code == 204

    old_login = client.post("/auth/login", data={"username": "pia@example.com", "password": "old-password"})
    assert old_login.status_code == 401
    new_login = client.post("/auth/login", data={"username": "pia@example.com", "password": "new-password"})
    assert new_login.status_code == 200


def test_password_change_rejects_wrong_or_reused_current_password(client):
    token = register_and_login(client, "Quinn", "quinn@example.com", "password123")
    headers = {"Authorization": f"Bearer {token}"}

    wrong_password = client.patch(
        "/auth/password",
        json={"current_password": "incorrect", "new_password": "new-password"},
        headers=headers,
    )
    assert wrong_password.status_code == 400
    assert wrong_password.json()["detail"] == "Current password is incorrect"

    reused_password = client.patch(
        "/auth/password",
        json={"current_password": "password123", "new_password": "password123"},
        headers=headers,
    )
    assert reused_password.status_code == 400
