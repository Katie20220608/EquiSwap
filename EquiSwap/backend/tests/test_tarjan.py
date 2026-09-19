from app.tarjan import TarjanSCC


def cycles_as_sets(graph: dict) -> list[frozenset]:
    """Return cycles as frozensets so order within each SCC doesn't matter."""
    return [frozenset(c) for c in TarjanSCC(graph).cycles()]


# ---------------------------------------------------------------------------
# 1. Empty graph
# ---------------------------------------------------------------------------
def test_empty_graph():
    assert TarjanSCC({}).cycles() == []


# ---------------------------------------------------------------------------
# 2. Single isolated node – no edges at all
# ---------------------------------------------------------------------------
def test_single_node_no_edges():
    assert TarjanSCC({1: []}).cycles() == []


# ---------------------------------------------------------------------------
# 3. Linear chain – no cycle
# ---------------------------------------------------------------------------
def test_linear_chain():
    graph = {1: [2], 2: [3], 3: []}
    assert TarjanSCC(graph).cycles() == []


# ---------------------------------------------------------------------------
# 4. Simple 2-way cycle (A↔B)
# ---------------------------------------------------------------------------
def test_two_way_cycle():
    graph = {1: [2], 2: [1]}
    result = cycles_as_sets(graph)
    assert frozenset({1, 2}) in result


# ---------------------------------------------------------------------------
# 5. Simple 3-way cycle (A→B→C→A)
# ---------------------------------------------------------------------------
def test_three_way_cycle():
    graph = {1: [2], 2: [3], 3: [1]}
    result = cycles_as_sets(graph)
    assert frozenset({1, 2, 3}) in result


# ---------------------------------------------------------------------------
# 6. 4-way cycle
# ---------------------------------------------------------------------------
def test_four_way_cycle():
    graph = {1: [2], 2: [3], 3: [4], 4: [1]}
    result = cycles_as_sets(graph)
    assert frozenset({1, 2, 3, 4}) in result


# ---------------------------------------------------------------------------
# 7. Two independent 2-way cycles
# ---------------------------------------------------------------------------
def test_two_independent_cycles():
    graph = {1: [2], 2: [1], 3: [4], 4: [3]}
    result = cycles_as_sets(graph)
    assert frozenset({1, 2}) in result
    assert frozenset({3, 4}) in result
    assert len(result) == 2


# ---------------------------------------------------------------------------
# 8. Cycle with a dangling tail (tail node is NOT part of the cycle)
# ---------------------------------------------------------------------------
def test_cycle_with_tail():
    # 1→2→3→2 : only 2 and 3 form a cycle; 1 is a tail
    graph = {1: [2], 2: [3], 3: [2]}
    result = cycles_as_sets(graph)
    assert frozenset({2, 3}) in result
    assert all(1 not in c for c in result)


# ---------------------------------------------------------------------------
# 9. Mixed: one cycle and several singletons
# ---------------------------------------------------------------------------
def test_cycle_among_singletons():
    graph = {1: [2], 2: [1], 3: [4], 4: []}
    result = cycles_as_sets(graph)
    assert frozenset({1, 2}) in result
    assert len(result) == 1


# ---------------------------------------------------------------------------
# 10. DAG – no cycles whatsoever
# ---------------------------------------------------------------------------
def test_dag_no_cycles():
    graph = {1: [2, 3], 2: [4], 3: [4], 4: []}
    assert TarjanSCC(graph).cycles() == []


# ---------------------------------------------------------------------------
# 11. Fully connected tournament (every pair bidirectional) among 3 nodes
# ---------------------------------------------------------------------------
def test_fully_connected_three_nodes():
    graph = {1: [2, 3], 2: [1, 3], 3: [1, 2]}
    result = cycles_as_sets(graph)
    # All three nodes must be in a single SCC
    assert frozenset({1, 2, 3}) in result


# ---------------------------------------------------------------------------
# 12. Two cycles joined at a single shared node (butterfly)
# ---------------------------------------------------------------------------
def test_butterfly_two_cycles_sharing_node():
    # Left cycle: 1→2→3→1 ; right cycle: 1→4→5→1
    # All five nodes end up in one large SCC because 1 connects both loops
    graph = {1: [2, 4], 2: [3], 3: [1], 4: [5], 5: [1]}
    result = cycles_as_sets(graph)
    assert frozenset({1, 2, 3, 4, 5}) in result


# ---------------------------------------------------------------------------
# 13. Self-loop only (size-1 SCC, excluded by cycles())
# ---------------------------------------------------------------------------
def test_self_loop_excluded():
    graph = {1: [1]}
    # cycles() only returns SCCs with >= 2 members
    assert TarjanSCC(graph).cycles() == []


# ---------------------------------------------------------------------------
# 14. Disconnected graph – cycle in one component, nothing in the other
# ---------------------------------------------------------------------------
def test_disconnected_graph():
    graph = {1: [2], 2: [1], 3: [], 4: [3]}
    result = cycles_as_sets(graph)
    assert frozenset({1, 2}) in result
    assert len(result) == 1


# ---------------------------------------------------------------------------
# 15. Large graph – 5-node cycle interleaved with singletons
# ---------------------------------------------------------------------------
def test_large_single_cycle_with_bystanders():
    # Cycle: 10→20→30→40→50→10; bystanders: 60→10, 70→[]
    graph = {
        10: [20],
        20: [30],
        30: [40],
        40: [50],
        50: [10],
        60: [10],
        70: [],
    }
    result = cycles_as_sets(graph)
    assert frozenset({10, 20, 30, 40, 50}) in result
    assert len(result) == 1


# ---------------------------------------------------------------------------
# 16. run() includes singletons; cycles() does not
# ---------------------------------------------------------------------------
def test_run_vs_cycles_distinction():
    graph = {1: [2], 2: [1], 3: []}
    t = TarjanSCC(graph)
    all_sccs = [frozenset(s) for s in t.run()]
    assert frozenset({3}) in all_sccs  # singleton present in run()

    t2 = TarjanSCC(graph)
    assert all(len(c) >= 2 for c in t2.cycles())  # cycles() has no singletons
