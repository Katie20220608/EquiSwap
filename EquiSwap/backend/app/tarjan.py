from __future__ import annotations


class TarjanSCC:
    """Tarjan's Strongly Connected Components algorithm.

    Accepts an adjacency list where each key is a node and each value is the
    list of neighbours that node has a directed edge to.  Call ``run()`` to
    get all SCCs; call ``cycles()`` to get only the SCCs that form genuine
    cycles (size >= 2 **or** a self-loop).

    In the EquiSwap context nodes are user_ids and an edge u→v means user u
    has an item in user v's wishlist (i.e. v wants something u owns).
    """

    def __init__(self, graph: dict[int, list[int]]) -> None:
        self.graph = graph
        self._index_counter = 0
        self._stack: list[int] = []
        self._on_stack: set[int] = set()
        self._index: dict[int, int] = {}
        self._lowlink: dict[int, int] = {}
        self._sccs: list[list[int]] = []

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def run(self) -> list[list[int]]:
        """Return all SCCs (including singletons)."""
        self._reset()
        for node in self.graph:
            if node not in self._index:
                self._strongconnect(node)
        return self._sccs

    def cycles(self) -> list[list[int]]:
        """Return only SCCs that represent genuine swap cycles (size >= 2)."""
        return [scc for scc in self.run() if len(scc) >= 2]

    # ------------------------------------------------------------------
    # Core algorithm
    # ------------------------------------------------------------------

    def _reset(self) -> None:
        self._index_counter = 0
        self._stack = []
        self._on_stack = set()
        self._index = {}
        self._lowlink = {}
        self._sccs = []

    def _strongconnect(self, v: int) -> None:
        self._index[v] = self._lowlink[v] = self._index_counter
        self._index_counter += 1
        self._stack.append(v)
        self._on_stack.add(v)

        for w in self.graph.get(v, []):
            if w not in self._index:
                self._strongconnect(w)
                self._lowlink[v] = min(self._lowlink[v], self._lowlink[w])
            elif w in self._on_stack:
                self._lowlink[v] = min(self._lowlink[v], self._index[w])

        # v is the root of an SCC — pop the stack
        if self._lowlink[v] == self._index[v]:
            scc: list[int] = []
            while True:
                w = self._stack.pop()
                self._on_stack.discard(w)
                scc.append(w)
                if w == v:
                    break
            self._sccs.append(scc)
