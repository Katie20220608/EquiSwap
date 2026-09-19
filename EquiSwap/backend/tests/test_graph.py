"""Direct unit tests for build_swap_graph."""

from app import models
from app.graph import build_swap_graph, find_elementary_cycles


def _make_user(db, name, email):
    user = models.User(name=name, email=email, password_hash="hashed")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_item(db, owner_id, name, status="available"):
    item = models.Item(owner_id=owner_id, name=name, status=status)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _get_db_session():
    from tests.conftest import TestingSessionLocal

    return TestingSessionLocal()


def test_build_swap_graph_creates_edges_between_wisher_and_owner():
    db = _get_db_session()
    try:
        alice = _make_user(db, "Alice", "alice_graph@example.com")
        bob = _make_user(db, "Bob", "bob_graph@example.com")
        item_b = _make_item(db, bob.user_id, "Bob's item")

        db.add(models.Wishlist(user_id=alice.user_id, item_id=item_b.item_id))
        db.commit()

        graph = build_swap_graph(db)
        assert graph[alice.user_id] == [bob.user_id]
        assert graph[bob.user_id] == []
    finally:
        db.close()


def test_build_swap_graph_excludes_unavailable_items_and_self_wishes():
    db = _get_db_session()
    try:
        alice = _make_user(db, "Alice2", "alice2_graph@example.com")
        bob = _make_user(db, "Bob2", "bob2_graph@example.com")
        own_item = _make_item(db, alice.user_id, "Alice's own item")
        unavailable_item = _make_item(db, bob.user_id, "Bob's swapped item", status="swapped")

        # Self-wish should be excluded
        db.add(models.Wishlist(user_id=alice.user_id, item_id=own_item.item_id))
        # Wish on an unavailable item should be excluded
        db.add(models.Wishlist(user_id=alice.user_id, item_id=unavailable_item.item_id))
        db.commit()

        graph = build_swap_graph(db)
        assert graph.get(alice.user_id, []) == []
    finally:
        db.close()


def test_build_swap_graph_deduplicates_repeated_edges():
    db = _get_db_session()
    try:
        alice = _make_user(db, "Alice3", "alice3_graph@example.com")
        bob = _make_user(db, "Bob3", "bob3_graph@example.com")
        item_1 = _make_item(db, bob.user_id, "Bob's item 1")
        item_2 = _make_item(db, bob.user_id, "Bob's item 2")

        db.add(models.Wishlist(user_id=alice.user_id, item_id=item_1.item_id))
        db.add(models.Wishlist(user_id=alice.user_id, item_id=item_2.item_id))
        db.commit()

        graph = build_swap_graph(db)
        # Both wishlist entries point to the same owner, so the edge is deduplicated
        assert graph[alice.user_id] == [bob.user_id]
    finally:
        db.close()


def test_find_elementary_cycles_returns_simple_cycle():
    graph = {1: [2], 2: [3], 3: [1]}
    cycles = find_elementary_cycles(graph)
    assert [frozenset(c) for c in cycles] == [frozenset({1, 2, 3})]


def test_find_elementary_cycles_splits_butterfly_into_two_triangles():
    # Left triangle: 1->2->3->1 ; right triangle sharing node 1: 1->4->5->1
    graph = {1: [2, 4], 2: [3], 3: [1], 4: [5], 5: [1]}
    cycles = find_elementary_cycles(graph)
    cycle_sets = [frozenset(c) for c in cycles]

    assert frozenset({1, 2, 3}) in cycle_sets
    assert frozenset({1, 4, 5}) in cycle_sets
    # No single elementary cycle should span all five nodes
    assert frozenset({1, 2, 3, 4, 5}) not in cycle_sets


def test_find_elementary_cycles_can_be_restricted_to_a_node_subset():
    graph = {1: [2], 2: [1], 3: [4], 4: [3]}
    cycles = find_elementary_cycles(graph, nodes={1, 2})
    assert [frozenset(c) for c in cycles] == [frozenset({1, 2})]
