import random
import statistics
import time

from app.tarjan import TarjanSCC


def build_graph(size: int, *, seed: int) -> dict[int, list[int]]:
    """Create a realistic directed graph with a cycle backbone plus extra edges."""
    rng = random.Random(seed)
    graph: dict[int, list[int]] = {node: [] for node in range(size)}

    # Create a strong cycle backbone so the algorithm will always have work to do.
    for node in range(size):
        graph[node].append((node + 1) % size)

    # Add a small number of random extra edges to mimic realistic wishlists.
    for node in range(size):
        extra_edges = rng.randint(0, min(3, size - 1))
        for _ in range(extra_edges):
            target = rng.randrange(size)
            if target != node:
                graph[node].append(target)

    for node in graph:
        graph[node] = sorted(set(graph[node]))

    return graph


def benchmark(size: int, *, runs: int = 20, seed: int = 42) -> dict[str, float | int]:
    graph = build_graph(size, seed=seed)
    samples: list[float] = []

    for _ in range(runs):
        start = time.perf_counter()
        result = TarjanSCC(graph).cycles()
        elapsed = time.perf_counter() - start
        samples.append(elapsed)
        if not isinstance(result, list):
            raise TypeError("TarjanSCC.cycles() must return a list of SCCs")

    return {
        "size": size,
        "runs": runs,
        "avg_ms": statistics.mean(samples) * 1000,
        "min_ms": min(samples) * 1000,
        "max_ms": max(samples) * 1000,
        "median_ms": statistics.median(samples) * 1000,
    }


def main() -> None:
    sizes = [10, 25, 50]
    results = [benchmark(size, runs=20, seed=42 + size) for size in sizes]

    print("Tarjan SCC performance benchmark")
    print("=" * 60)
    print(
        f"{'users':>6}  {'runs':>5}  {'avg (ms)':>10}  "
        f"{'median (ms)':>13}  {'min (ms)':>10}  {'max (ms)':>10}"
    )
    for result in results:
        print(
            f"{result['size']:>6}  {result['runs']:>5}  "
            f"{result['avg_ms']:>10.4f}  {result['median_ms']:>13.4f}  "
            f"{result['min_ms']:>10.4f}  {result['max_ms']:>10.4f}"
        )


if __name__ == "__main__":
    main()
