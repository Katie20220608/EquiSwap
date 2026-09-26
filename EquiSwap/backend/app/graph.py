from __future__ import annotations

from sqlalchemy.orm import Session

from app import models


def preference_pair(user_id: int, other_user_id: int) -> tuple[int, int]:
    """Return a direction-independent identifier for a user pairing."""
    return tuple(sorted((user_id, other_user_id)))


def get_blocked_pairs(db: Session) -> set[tuple[int, int]]:
    """Return pairings blocked by either participant's saved preference."""
    return {
        preference_pair(user_id, avoid_user_id)
        for user_id, avoid_user_id in db.query(
            models.UserPreference.user_id,
            models.UserPreference.avoid_user_id,
        ).all()
    }


def build_swap_graph(db: Session) -> dict[int, list[int]]:
    """Return a directed adjacency list representing swap desires.

    Edge  wisher_id → owner_id  means: wisher_id wants an available item
    that owner_id currently owns.  Self-loops and duplicate edges are excluded.
    """
    rows = (
        db.query(models.Wishlist.user_id, models.Item.owner_id)
        .join(models.Item, models.Wishlist.item_id == models.Item.item_id)
        .filter(
            models.Item.status == "available",
            models.Wishlist.user_id != models.Item.owner_id,
        )
        .all()
    )

    blocked_pairs = get_blocked_pairs(db)
    graph: dict[int, list[int]] = {}
    for wisher_id, owner_id in rows:
        if preference_pair(wisher_id, owner_id) in blocked_pairs:
            continue
        neighbours = graph.setdefault(wisher_id, [])
        if owner_id not in neighbours:
            neighbours.append(owner_id)
        # ensure every owner node exists in the graph even if it has no out-edges
        graph.setdefault(owner_id, [])

    return graph


def find_elementary_cycles(graph: dict[int, list[int]], nodes: set[int] | None = None) -> list[list[int]]:
    """Enumerate elementary (simple) cycles, optionally restricted to `nodes`.

    A strongly connected component is not guaranteed to contain a single
    Hamiltonian cycle through every one of its members (e.g. two triangles
    sharing one node), so callers that need a concrete, proposable swap
    cycle should use this instead of treating the whole SCC as one cycle.
    Each cycle's smallest node id is used as its DFS start to avoid emitting
    the same cycle once per rotation.
    """
    candidate_nodes = sorted(nodes) if nodes is not None else sorted(graph)
    cycles: list[list[int]] = []
    for start in candidate_nodes:
        stack: list[tuple[int, list[int], set[int]]] = [(start, [start], {start})]
        while stack:
            node, path, visited = stack.pop()
            for neighbour in graph.get(node, []):
                if nodes is not None and neighbour not in nodes:
                    continue
                if neighbour == start and len(path) >= 2:
                    cycles.append(path[:])
                elif neighbour > start and neighbour not in visited:
                    stack.append((neighbour, path + [neighbour], visited | {neighbour}))
    return cycles
