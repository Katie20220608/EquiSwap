"""Integration tests for accepted-swap group messaging."""


def _create_user(client, name: str, email: str) -> tuple[str, int]:
    client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    token = client.post(
        "/auth/login",
        data={"username": email, "password": "password123"},
    ).json()["access_token"]
    user_id = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    ).json()["user_id"]
    return token, user_id


def _setup_cycle(client):
    participants = []
    for name, email in (
        ("Message Alice", "message_alice@example.com"),
        ("Message Bob", "message_bob@example.com"),
    ):
        token, user_id = _create_user(client, name, email)
        item_id = client.post(
            "/items/",
            json={"name": f"{name} item", "condition_score": 7, "status": "available"},
            headers={"Authorization": f"Bearer {token}"},
        ).json()["item_id"]
        participants.append({"token": token, "user_id": user_id, "item_id": item_id})

    for index, participant in enumerate(participants):
        client.post(
            "/wishlists/",
            json={"item_id": participants[(index + 1) % 2]["item_id"]},
            headers={"Authorization": f"Bearer {participant['token']}"},
        )

    proposals = client.post(
        "/swaps/propose",
        json={"user_ids": [participant["user_id"] for participant in participants]},
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    ).json()
    return participants, proposals


def _accept_proposal(client, participants, proposals, participant_index: int) -> None:
    user_id = participants[participant_index]["user_id"]
    proposal = next(proposal for proposal in proposals if proposal["giver_id"] == user_id)
    response = client.patch(
        f"/swaps/{proposal['sp_id']}/respond",
        json={"decision": "accepted"},
        headers={"Authorization": f"Bearer {participants[participant_index]['token']}"},
    )
    assert response.status_code == 200


def test_only_accepted_participants_can_read_and_send_cycle_messages(client):
    participants, proposals = _setup_cycle(client)
    cycle_id = proposals[0]["cycle_id"]
    message_url = f"/messages/cycles/{cycle_id}"

    pending_access = client.get(
        message_url,
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert pending_access.status_code == 403

    _accept_proposal(client, participants, proposals, 0)
    first_message = client.post(
        message_url,
        json={"message": "  Can we meet at the library at 3 pm?  "},
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert first_message.status_code == 201
    assert first_message.json()["message"] == "Can we meet at the library at 3 pm?"
    assert first_message.json()["sender_name"] == "Message Alice"
    pending_notifications = client.get(
        "/notifications/",
        headers={"Authorization": f"Bearer {participants[1]['token']}"},
    ).json()
    assert not [
        notification for notification in pending_notifications if notification["type"] == "swap_message"
    ]

    pending_participant_access = client.get(
        message_url,
        headers={"Authorization": f"Bearer {participants[1]['token']}"},
    )
    assert pending_participant_access.status_code == 403

    outsider_token, _ = _create_user(client, "Message Outsider", "message_outsider@example.com")
    outsider_access = client.get(
        message_url,
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert outsider_access.status_code == 403

    _accept_proposal(client, participants, proposals, 1)
    notification_message = client.post(
        message_url,
        json={"message": "The library entrance works for me."},
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert notification_message.status_code == 201

    received_notifications = client.get(
        "/notifications/",
        headers={"Authorization": f"Bearer {participants[1]['token']}"},
    ).json()
    message_notifications = [
        notification for notification in received_notifications if notification["type"] == "swap_message"
    ]
    assert len(message_notifications) == 1
    assert message_notifications[0]["related_cycle_id"] == cycle_id
    assert "Message Alice" in message_notifications[0]["message"]

    second_message = client.post(
        message_url,
        json={"message": "That works. I will bring the item."},
        headers={"Authorization": f"Bearer {participants[1]['token']}"},
    )
    assert second_message.status_code == 201

    history = client.get(
        message_url,
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert history.status_code == 200
    assert [message["message"] for message in history.json()] == [
        "Can we meet at the library at 3 pm?",
        "The library entrance works for me.",
        "That works. I will bring the item.",
    ]


def test_cycle_message_rejects_blank_content(client):
    participants, proposals = _setup_cycle(client)
    _accept_proposal(client, participants, proposals, 0)

    response = client.post(
        f"/messages/cycles/{proposals[0]['cycle_id']}",
        json={"message": "   "},
        headers={"Authorization": f"Bearer {participants[0]['token']}"},
    )
    assert response.status_code == 422
