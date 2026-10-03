"""End-to-end acceptance scenarios for the swap lifecycle."""

import pytest


def _create_participant(client, name: str, email: str) -> tuple[str, int]:
    client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    login = client.post(
        "/auth/login",
        data={"username": email, "password": "password123"},
    )
    token = login.json()["access_token"]
    user_id = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    ).json()["user_id"]
    return token, user_id


def _create_cycle(client, participant_count: int, prefix: str, *, add_wishlists: bool = True):
    participants = []
    for index in range(participant_count):
        token, user_id = _create_participant(
            client,
            f"{prefix} User {index}",
            f"{prefix.lower()}_{index}@example.com",
        )
        item_response = client.post(
            "/items/",
            json={"name": f"{prefix} item {index}", "condition_score": 7, "status": "available"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert item_response.status_code == 201
        participants.append({"token": token, "user_id": user_id, "item_id": item_response.json()["item_id"]})

    if add_wishlists:
        for index, participant in enumerate(participants):
            wanted_item = participants[(index + 1) % participant_count]["item_id"]
            wishlist_response = client.post(
                "/wishlists/",
                json={"item_id": wanted_item},
                headers={"Authorization": f"Bearer {participant['token']}"},
            )
            assert wishlist_response.status_code == 201

    return participants


@pytest.mark.parametrize("participant_count", range(2, 9), ids=lambda count: f"complete-{count}-person")
def test_acceptance_completed_exchange_transfers_every_item(client, participant_count):
    participants = _create_cycle(client, participant_count, f"Complete{participant_count}")
    user_ids = [participant["user_id"] for participant in participants]
    proposals_response = client.post(
        "/swaps/propose",
        json={"user_ids": user_ids},
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert proposals_response.status_code == 201
    proposals = proposals_response.json()
    assert len(proposals) == participant_count
    assert {proposal["status"] for proposal in proposals} == {"pending"}

    for proposal in proposals:
        giver = next(person for person in participants if person["user_id"] == proposal["giver_id"])
        response = client.patch(
            f"/swaps/{proposal['sp_id']}/respond",
            json={"decision": "accepted"},
            headers={"Authorization": f"Bearer {giver['token']}"},
        )
        assert response.status_code == 200

    cycle_response = client.get(
        f"/swaps/cycles/{proposals[0]['cycle_id']}",
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert cycle_response.status_code == 200
    assert {proposal["status"] for proposal in cycle_response.json()} == {"accepted"}

    for proposal in proposals:
        item_response = client.get(f"/items/{proposal['item_id']}")
        assert item_response.status_code == 200
        assert item_response.json()["status"] == "swapped"
        assert item_response.json()["owner_id"] == proposal["receiver_id"]


@pytest.mark.parametrize("participant_count", range(2, 6), ids=lambda count: f"reject-{count}-person")
def test_acceptance_rejection_cancels_cycle_and_frees_items(client, participant_count):
    participants = _create_cycle(client, participant_count, f"Reject{participant_count}")
    proposals_response = client.post(
        "/swaps/propose",
        json={"user_ids": [participant["user_id"] for participant in participants]},
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert proposals_response.status_code == 201
    proposals = proposals_response.json()
    rejected = proposals[participant_count // 2]
    rejector = next(person for person in participants if person["user_id"] == rejected["giver_id"])

    response = client.patch(
        f"/swaps/{rejected['sp_id']}/respond",
        json={"decision": "rejected", "rejection_reason": "Acceptance scenario rejection"},
        headers={"Authorization": f"Bearer {rejector['token']}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"

    cycle_response = client.get(
        f"/swaps/cycles/{rejected['cycle_id']}",
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    statuses = {proposal["sp_id"]: proposal["status"] for proposal in cycle_response.json()}
    assert statuses[rejected["sp_id"]] == "rejected"
    assert all(status == "cancelled" for sp_id, status in statuses.items() if sp_id != rejected["sp_id"])

    for proposal in proposals:
        item = client.get(f"/items/{proposal['item_id']}").json()
        assert item["status"] == "available"


@pytest.mark.parametrize(
    "scenario",
    [
        "single-member-cycle",
        "duplicate-member-cycle",
        "outsider-proposes-cycle",
        "cycle-without-wishlist-edges",
        "unauthenticated-proposal",
        "non-giver-responds",
        "invalid-response-decision",
        "duplicate-response",
        "unknown-proposal",
    ],
)
def test_acceptance_rejects_invalid_or_unauthorized_exchange(client, scenario):
    participants = _create_cycle(
        client,
        2,
        f"Invalid{scenario.replace('-', '')}",
        add_wishlists=scenario != "cycle-without-wishlist-edges",
    )
    user_ids = [participant["user_id"] for participant in participants]
    first_headers = {"Authorization": f"Bearer {participants[0]['token']}"}

    if scenario == "single-member-cycle":
        response = client.post("/swaps/propose", json={"user_ids": user_ids[:1]}, headers=first_headers)
        expected_status = 422
    elif scenario == "duplicate-member-cycle":
        response = client.post(
            "/swaps/propose", json={"user_ids": [user_ids[0], user_ids[0]]}, headers=first_headers
        )
        expected_status = 422
    elif scenario == "outsider-proposes-cycle":
        outsider_token, _ = _create_participant(client, "Outsider", "acceptance_outsider@example.com")
        response = client.post(
            "/swaps/propose",
            json={"user_ids": user_ids},
            headers={"Authorization": f"Bearer {outsider_token}"},
        )
        expected_status = 403
    elif scenario == "cycle-without-wishlist-edges":
        response = client.post("/swaps/propose", json={"user_ids": user_ids}, headers=first_headers)
        expected_status = 422
    elif scenario == "unauthenticated-proposal":
        response = client.post("/swaps/propose", json={"user_ids": user_ids})
        expected_status = 401
    else:
        proposals_response = client.post(
            "/swaps/propose",
            json={"user_ids": user_ids},
            headers=first_headers,
        )
        assert proposals_response.status_code == 201
        proposals = proposals_response.json()
        first_proposal = next(p for p in proposals if p["giver_id"] == user_ids[0])

        if scenario == "non-giver-responds":
            response = client.patch(
                f"/swaps/{first_proposal['sp_id']}/respond",
                json={"decision": "accepted"},
                headers={"Authorization": f"Bearer {participants[1]['token']}"},
            )
            expected_status = 403
        elif scenario == "invalid-response-decision":
            response = client.patch(
                f"/swaps/{first_proposal['sp_id']}/respond",
                json={"decision": "maybe"},
                headers=first_headers,
            )
            expected_status = 422
        elif scenario == "duplicate-response":
            accepted = client.patch(
                f"/swaps/{first_proposal['sp_id']}/respond",
                json={"decision": "accepted"},
                headers=first_headers,
            )
            assert accepted.status_code == 200
            response = client.patch(
                f"/swaps/{first_proposal['sp_id']}/respond",
                json={"decision": "accepted"},
                headers=first_headers,
            )
            expected_status = 409
        else:
            response = client.patch(
                "/swaps/999999/respond",
                json={"decision": "accepted"},
                headers=first_headers,
            )
            expected_status = 404

    assert response.status_code == expected_status, response.text
