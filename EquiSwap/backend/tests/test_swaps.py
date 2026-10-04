"""Integration tests for POST /swaps/propose and PATCH /swaps/{sp_id}/respond."""

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


# ---------------------------------------------------------------------------
# Two-user cycle: Alice gives item_b → Alice, Bob gives item_a → Bob
# ---------------------------------------------------------------------------


@pytest.fixture
def two_user_cycle(client):
    """Set up a valid 2-user cycle and return tokens/ids."""
    token_a, uid_a = _register_login(client, "Alice", "alice@example.com")
    token_b, uid_b = _register_login(client, "Bob", "bob@example.com")

    item_a = _create_item(client, token_a, "Alice's toy")
    item_b = _create_item(client, token_b, "Bob's bike")

    # Alice wants Bob's item; Bob wants Alice's item
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


def test_propose_creates_proposals_and_notifications(client, two_user_cycle):
    ctx = two_user_cycle
    res = client.post(
        "/swaps/propose",
        json={"user_ids": [ctx["uid_a"], ctx["uid_b"]]},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 201
    proposals = res.json()
    assert len(proposals) == 2
    statuses = {p["status"] for p in proposals}
    assert statuses == {"pending"}

    # Items should now be swap_pending
    item_a = client.get(f"/items/{ctx['item_a']}").json()
    item_b = client.get(f"/items/{ctx['item_b']}").json()
    assert item_a["status"] == "swap_pending"
    assert item_b["status"] == "swap_pending"


def test_propose_fails_if_not_in_cycle(client, two_user_cycle):
    ctx = two_user_cycle
    token_c, uid_c = _register_login(client, "Carol", "carol@example.com")
    res = client.post(
        "/swaps/propose",
        json={"user_ids": [ctx["uid_a"], ctx["uid_b"]]},
        headers={"Authorization": f"Bearer {token_c}"},
    )
    assert res.status_code == 403


def test_propose_fails_with_duplicate_users(client, two_user_cycle):
    ctx = two_user_cycle
    res = client.post(
        "/swaps/propose",
        json={"user_ids": [ctx["uid_a"], ctx["uid_a"]]},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 422


def test_propose_fails_with_single_user(client, two_user_cycle):
    ctx = two_user_cycle
    res = client.post(
        "/swaps/propose",
        json={"user_ids": [ctx["uid_a"]]},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 422


def test_list_my_proposals_returns_only_involved_proposals(client, two_user_cycle):
    ctx = two_user_cycle
    client.post(
        "/swaps/propose",
        json={"user_ids": [ctx["uid_a"], ctx["uid_b"]]},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )

    token_c, _ = _register_login(client, "Carol", "carol@example.com")

    res_a = client.get("/swaps/mine", headers={"Authorization": f"Bearer {ctx['token_a']}"})
    assert res_a.status_code == 200
    assert len(res_a.json()) == 2

    res_c = client.get("/swaps/mine", headers={"Authorization": f"Bearer {token_c}"})
    assert res_c.status_code == 200
    assert res_c.json() == []


def _propose(client, token, user_ids) -> list:
    res = client.post(
        "/swaps/propose",
        json={"user_ids": user_ids},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.json()
    return res.json()


def test_both_accept_executes_swap(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])

    # Find each user's proposal (they are givers of their own items)
    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])
    sp_b = next(p for p in proposals if p["giver_id"] == ctx["uid_b"])

    # Alice accepts (she gives item_a)
    res = client.patch(
        f"/swaps/{sp_a['sp_id']}/respond",
        json={"decision": "accepted"},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "accepted"

    # Bob accepts → swap should execute
    res = client.patch(
        f"/swaps/{sp_b['sp_id']}/respond",
        json={"decision": "accepted"},
        headers={"Authorization": f"Bearer {ctx['token_b']}"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "accepted"

    # Items should now be owned by the other person and marked swapped
    item_a = client.get(f"/items/{ctx['item_a']}").json()
    item_b = client.get(f"/items/{ctx['item_b']}").json()
    assert item_a["status"] == "swapped"
    assert item_a["owner_id"] == ctx["uid_b"]
    assert item_b["status"] == "swapped"
    assert item_b["owner_id"] == ctx["uid_a"]

    # Both participants should be rewarded for the completed swap
    trust_a = client.get(
        f"/users/{ctx['uid_a']}/trust", headers={"Authorization": f"Bearer {ctx['token_a']}"}
    ).json()
    assert trust_a["trust_score"] == 105
    assert len(trust_a["history"]) == 1
    assert trust_a["history"][0]["action"] == "completed_swap"
    assert trust_a["history"][0]["score_change"] == 5


def test_rejection_cancels_cycle_and_penalises_rejector(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])

    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])

    res = client.patch(
        f"/swaps/{sp_a['sp_id']}/respond",
        json={"decision": "rejected", "rejection_reason": "changed my mind"},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "rejected"
    assert data["rejection_reason"] == "changed my mind"

    # Items should be freed
    item_a = client.get(f"/items/{ctx['item_a']}").json()
    assert item_a["status"] == "available"

    # Rejector should be penalised and the change logged
    trust_a = client.get(
        f"/users/{ctx['uid_a']}/trust", headers={"Authorization": f"Bearer {ctx['token_a']}"}
    ).json()
    assert trust_a["trust_score"] == 95
    assert len(trust_a["history"]) == 1
    assert trust_a["history"][0]["action"] == "rejected_swap"
    assert trust_a["history"][0]["score_change"] == -5

    # The rejection is learned as a reversible preference, preventing the
    # same pairing from being proposed again.
    preferences = client.get("/preferences/", headers={"Authorization": f"Bearer {ctx['token_a']}"}).json()
    assert len(preferences) == 1
    assert preferences[0]["avoid_user_id"] == ctx["uid_b"]
    assert preferences[0]["reason"] == "Rejected swap: changed my mind"

    repeat = client.post(
        "/swaps/propose",
        json={"user_ids": [ctx["uid_a"], ctx["uid_b"]]},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert repeat.status_code == 422


def test_non_giver_cannot_respond(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])

    # Bob tries to respond to Alice's proposal
    res = client.patch(
        f"/swaps/{sp_a['sp_id']}/respond",
        json={"decision": "accepted"},
        headers={"Authorization": f"Bearer {ctx['token_b']}"},
    )
    assert res.status_code == 403


def test_double_response_rejected(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])

    client.patch(
        f"/swaps/{sp_a['sp_id']}/respond",
        json={"decision": "accepted"},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    res = client.patch(
        f"/swaps/{sp_a['sp_id']}/respond",
        json={"decision": "accepted"},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 409


def test_invalid_decision_rejected(client, two_user_cycle):
    ctx = two_user_cycle
    proposals = _propose(client, ctx["token_a"], [ctx["uid_a"], ctx["uid_b"]])
    sp_a = next(p for p in proposals if p["giver_id"] == ctx["uid_a"])

    res = client.patch(
        f"/swaps/{sp_a['sp_id']}/respond",
        json={"decision": "maybe"},
        headers={"Authorization": f"Bearer {ctx['token_a']}"},
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# /swaps/find should return concrete, proposable elementary cycles even when
# the underlying strongly connected component has no single Hamiltonian cycle
# through all of its members (e.g. two triangles sharing one node).
# ---------------------------------------------------------------------------


def test_find_decomposes_butterfly_scc_into_proposable_cycles(client):
    token_a, uid_a = _register_login(client, "Butterfly A", "butterfly_a@example.com")
    token_b, uid_b = _register_login(client, "Butterfly B", "butterfly_b@example.com")
    token_c, uid_c = _register_login(client, "Butterfly C", "butterfly_c@example.com")
    token_d, uid_d = _register_login(client, "Butterfly D", "butterfly_d@example.com")
    token_e, uid_e = _register_login(client, "Butterfly E", "butterfly_e@example.com")

    item_a1 = _create_item(client, token_a, "A's item 1")
    item_a2 = _create_item(client, token_a, "A's item 2")
    item_b = _create_item(client, token_b, "B's item")
    item_c = _create_item(client, token_c, "C's item")
    item_d = _create_item(client, token_d, "D's item")
    item_e = _create_item(client, token_e, "E's item")

    # Left triangle: A -> B -> C -> A (uses A's first item)
    _add_wishlist(client, token_a, item_b)
    _add_wishlist(client, token_b, item_c)
    _add_wishlist(client, token_c, item_a1)
    # Right triangle sharing node A: A -> D -> E -> A (uses A's second item)
    _add_wishlist(client, token_a, item_d)
    _add_wishlist(client, token_d, item_e)
    _add_wishlist(client, token_e, item_a2)

    res = client.get(f"/swaps/find/{uid_a}", headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 200
    cycles = res.json()["cycles"]

    cycle_sets = [frozenset(c) for c in cycles]
    assert frozenset({uid_a, uid_b, uid_c}) in cycle_sets
    assert frozenset({uid_a, uid_d, uid_e}) in cycle_sets
    # The full 5-node group has no Hamiltonian cycle, so it must not appear
    assert frozenset({uid_a, uid_b, uid_c, uid_d, uid_e}) not in cycle_sets

    # Every cycle returned must actually be proposable as-is
    for cycle in cycles:
        proposer_token = {
            uid_a: token_a,
            uid_b: token_b,
            uid_c: token_c,
            uid_d: token_d,
            uid_e: token_e,
        }[cycle[0]]
        propose_res = client.post(
            "/swaps/propose",
            json={"user_ids": cycle},
            headers={"Authorization": f"Bearer {proposer_token}"},
        )
        assert propose_res.status_code == 201
