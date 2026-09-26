import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  ApiError,
  deleteItem,
  deleteWishlistEntry,
  findSwapCycles,
  listItems,
  listMySwapHistory,
  listMySwapProposals,
  listMyWishlist,
  listUsers,
  proposeSwap,
  respondToSwapProposal,
} from "../lib/api";
import type {
  ApiItem,
  ApiSwapHistory,
  ApiSwapProposal,
  ApiUser,
  ApiWishlistEntry,
} from "../lib/api";
import { ItemForm } from "../components/ItemForm";
import { ItemBrowseCard } from "../components/ItemBrowseCard";
import { CycleVisualisation } from "../components/CycleVisualisation";
import { TopNav } from "../components/TopNav";
import "./Dashboard.css";

type LoadState = "loading" | "ready" | "error";

export function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<ApiItem[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [wishlist, setWishlist] = useState<ApiWishlistEntry[]>([]);
  const [proposals, setProposals] = useState<ApiSwapProposal[]>([]);
  const [swapHistory, setSwapHistory] = useState<ApiSwapHistory[]>([]);
  const [cycles, setCycles] = useState<number[][]>([]);
  const [cycleItemIds, setCycleItemIds] = useState<
    Record<string, (number | null)[]>
  >({});
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSwappedItemsOpen, setIsSwappedItemsOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposingCycle, setProposingCycle] = useState<string | null>(null);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [deletingWishlistId, setDeletingWishlistId] = useState<number | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setLoadState("loading");

    Promise.all([
      listItems(),
      listMyWishlist(),
      listMySwapProposals(),
      listMySwapHistory(),
      listUsers(),
      findSwapCycles(user.user_id),
    ])
      .then(
        ([
          itemsResult,
          wishlistResult,
          proposalsResult,
          historyResult,
          usersResult,
          cyclesResult,
        ]) => {
          if (cancelled) return;
          setItems(itemsResult);
          setWishlist(wishlistResult);
          setProposals(proposalsResult);
          setSwapHistory(historyResult);
          setUsers(usersResult);
          setCycles(cyclesResult.cycles);
          setCycleItemIds(
            Object.fromEntries(
              cyclesResult.cycles.map((cycle, index) => [
                cycle.join("-"),
                cyclesResult.cycle_item_ids?.[index] ?? [],
              ]),
            ),
          );
          setLoadState("ready");
        },
      )
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load your dashboard. Please try again.",
        );
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <main className="dashboard-shell">
        <p className="eyebrow">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const mySwappedItems = items.filter(
    (item) => item.owner_id === user.user_id && item.status === "swapped",
  );
  const myItems = items.filter(
    (item) => item.owner_id === user.user_id && item.status !== "swapped",
  );
  const itemsById = new Map(items.map((item) => [item.item_id, item]));
  const namesByUserId = new Map(users.map((u) => [u.user_id, u.name]));
  const wishlistedItemIds = new Set(wishlist.map((entry) => entry.item_id));
  const browsableItems = items.filter(
    (item) => item.owner_id !== user.user_id && item.status === "available",
  );

  function formatSwapDate(swapDate: string | null): string {
    if (!swapDate) return "Date unavailable";

    const date = new Date(swapDate);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
  }

  function handleItemSaved(saved: ApiItem) {
    setItems((current) => {
      const exists = current.some((item) => item.item_id === saved.item_id);
      return exists
        ? current.map((item) => (item.item_id === saved.item_id ? saved : item))
        : [...current, saved];
    });
    setIsAddingItem(false);
    setEditingItemId(null);
  }

  function handleWishlistAdded(entry: ApiWishlistEntry) {
    setWishlist((current) => [...current, entry]);
  }

  async function handleDeleteItem(itemId: number) {
    setDeleteError(null);
    setDeletingItemId(itemId);
    try {
      await deleteItem(itemId);
      setItems((current) => current.filter((item) => item.item_id !== itemId));
      setWishlist((current) =>
        current.filter((entry) => entry.item_id !== itemId),
      );
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Unable to delete the item. Please try again.",
      );
    } finally {
      setDeletingItemId(null);
    }
  }

  async function handleDeleteWishlistEntry(wishlistId: number) {
    setDeleteError(null);
    setDeletingWishlistId(wishlistId);
    try {
      await deleteWishlistEntry(wishlistId);
      setWishlist((current) =>
        current.filter((entry) => entry.wishlist_id !== wishlistId),
      );
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Unable to remove the wishlist entry. Please try again.",
      );
    } finally {
      setDeletingWishlistId(null);
    }
  }

  async function handleProposalResponse(
    proposal: ApiSwapProposal,
    decision: "accepted" | "rejected",
  ) {
    setProposalError(null);
    setRespondingId(proposal.sp_id);
    try {
      const updated = await respondToSwapProposal(proposal.sp_id, decision);
      setProposals((current) =>
        current.map((p) => (p.sp_id === updated.sp_id ? updated : p)),
      );
    } catch (err) {
      setProposalError(
        err instanceof ApiError
          ? err.message
          : "Unable to record your response. Please try again.",
      );
    } finally {
      setRespondingId(null);
    }
  }

  async function handleProposeCycle(cycleUserIds: number[]) {
    const key = cycleUserIds.join("-");
    setCycleError(null);
    setProposingCycle(key);
    try {
      const created = await proposeSwap(cycleUserIds);
      setProposals((current) => [...created, ...current]);
      setCycles((current) =>
        current.filter((cycle) => cycle.join("-") !== key),
      );
      setCycleItemIds((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (err) {
      setCycleError(
        err instanceof ApiError
          ? err.message
          : "Unable to propose this swap. Please try again.",
      );
    } finally {
      setProposingCycle(null);
    }
  }

  return (
    <main className="dashboard-shell">
      <TopNav
        eyebrow="EquiSwap / dashboard"
        heading={`Welcome back, ${user.name}.`}
      />

      {loadState === "loading" && <p>Loading your dashboard...</p>}
      {loadState === "error" && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {loadState === "ready" && (
        <div className="dashboard-grid">
          <section
            className="dashboard-panel"
            aria-labelledby="my-items-heading"
          >
            <div className="dashboard-panel-heading">
              <h2 id="my-items-heading">My items ({myItems.length})</h2>
              <button
                type="button"
                className="dashboard-toggle"
                onClick={() => setIsAddingItem((current) => !current)}
              >
                {isAddingItem ? "Close" : "+ Add item"}
              </button>
            </div>

            {deleteError && (
              <p className="field-error" role="alert">
                {deleteError}
              </p>
            )}

            {isAddingItem && (
              <ItemForm
                onSaved={handleItemSaved}
                onCancel={() => setIsAddingItem(false)}
              />
            )}

            {myItems.length === 0 ? (
              <p className="dashboard-empty">
                You haven't listed any items yet.
              </p>
            ) : (
              <ul className="dashboard-list">
                {myItems.map((item) => (
                  <li key={item.item_id} className="dashboard-list-item">
                    {editingItemId === item.item_id ? (
                      <ItemForm
                        item={item}
                        onSaved={handleItemSaved}
                        onCancel={() => setEditingItemId(null)}
                      />
                    ) : (
                      <>
                        <span>{item.name}</span>
                        <span className="dashboard-list-actions">
                          <span className={`status-pill status-${item.status}`}>
                            {item.status.replace("_", " ")}
                          </span>
                          <button
                            type="button"
                            className="dashboard-toggle"
                            onClick={() => setEditingItemId(item.item_id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="dashboard-toggle dashboard-delete"
                            onClick={() => handleDeleteItem(item.item_id)}
                            disabled={deletingItemId === item.item_id}
                          >
                            {deletingItemId === item.item_id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="swapped-items-toggle"
              aria-expanded={isSwappedItemsOpen}
              aria-controls="swapped-items-content"
              onClick={() => setIsSwappedItemsOpen((current) => !current)}
            >
              <span>My swapped items ({mySwappedItems.length})</span>
              <span aria-hidden="true">{isSwappedItemsOpen ? "−" : "+"}</span>
            </button>

            {isSwappedItemsOpen && (
              <div id="swapped-items-content" className="swapped-items-content">
                {mySwappedItems.length === 0 ? (
                  <p className="dashboard-empty">
                    Completed swap items will appear here.
                  </p>
                ) : (
                  <ul className="dashboard-list">
                    {mySwappedItems.map((item) => (
                      <li key={item.item_id} className="dashboard-list-item">
                        <span>{item.name}</span>
                        <span className="dashboard-list-actions">
                          <span className="status-pill status-swapped">
                            swapped
                          </span>
                          <span className="dashboard-list-meta">
                            Editing disabled after swap
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section
            className="dashboard-panel"
            aria-labelledby="wishlist-heading"
          >
            <h2 id="wishlist-heading">Wishlist ({wishlist.length})</h2>

            {wishlist.length === 0 ? (
              <p className="dashboard-empty">
                You haven't wished for any items yet. Browse available items
                below to add some.
              </p>
            ) : (
              <ul className="dashboard-list">
                {wishlist.map((entry) => {
                  const item = itemsById.get(entry.item_id);
                  return (
                    <li key={entry.wishlist_id} className="dashboard-list-item">
                      <span>{item ? item.name : `Item #${entry.item_id}`}</span>
                      {item && (
                        <span className={`status-pill status-${item.status}`}>
                          {item.status.replace("_", " ")}
                        </span>
                      )}
                      <button
                        type="button"
                        className="dashboard-toggle dashboard-delete"
                        onClick={() =>
                          handleDeleteWishlistEntry(entry.wishlist_id)
                        }
                        disabled={deletingWishlistId === entry.wishlist_id}
                      >
                        {deletingWishlistId === entry.wishlist_id
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            className="dashboard-panel dashboard-panel-wide"
            aria-labelledby="browse-heading"
          >
            <h2 id="browse-heading">Browse items ({browsableItems.length})</h2>
            {browsableItems.length === 0 ? (
              <p className="dashboard-empty">
                There are no other available items to browse right now.
              </p>
            ) : (
              <div className="browse-items-scroll">
                <div className="item-card-grid">
                  {browsableItems.map((item) => (
                    <ItemBrowseCard
                      key={item.item_id}
                      item={item}
                      ownerName={namesByUserId.get(item.owner_id) ?? "Unknown"}
                      isWishlisted={wishlistedItemIds.has(item.item_id)}
                      onAdded={handleWishlistAdded}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section
            className="dashboard-panel dashboard-panel-wide"
            aria-labelledby="matches-heading"
          >
            <h2 id="matches-heading">
              Potential swap matches ({cycles.length})
            </h2>
            {cycleError && (
              <p className="field-error" role="alert">
                {cycleError}
              </p>
            )}
            {cycles.length === 0 ? (
              <p className="dashboard-empty">
                No swap cycles found yet. Add items to your wishlist to get
                matched.
              </p>
            ) : (
              <ul className="dashboard-list">
                {cycles.map((cycle) => {
                  const key = cycle.join("-");
                  const participantDetails = cycle.map((id, index) => {
                    const swapItemId = cycleItemIds[key]?.[index];
                    const swapItem = swapItemId
                      ? itemsById.get(swapItemId)
                      : undefined;

                    return {
                      name: namesByUserId.get(id) ?? `User #${id}`,
                      id,
                      itemId: swapItem?.item_id,
                      itemName: swapItem?.name,
                    };
                  });
                  const isProposing = proposingCycle === key;
                  return (
                    <li key={key} className="dashboard-list-item match-item">
                      <CycleVisualisation participants={participantDetails} />
                      <button
                        type="button"
                        className="dashboard-toggle"
                        disabled={isProposing}
                        onClick={() => handleProposeCycle(cycle)}
                      >
                        Propose swap
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            className="dashboard-panel dashboard-panel-wide"
            aria-labelledby="status-heading"
          >
            <h2 id="status-heading">Swap status ({proposals.length})</h2>
            {proposalError && (
              <p className="field-error" role="alert">
                {proposalError}
              </p>
            )}
            {proposals.length === 0 ? (
              <p className="dashboard-empty">
                You have no swap proposals right now.
              </p>
            ) : (
              <div className="dashboard-section-scroll">
                <ul className="dashboard-list">
                  {proposals.map((proposal) => {
                    const item = itemsById.get(proposal.item_id);
                    const role =
                      proposal.giver_id === user.user_id
                        ? "giving"
                        : "receiving";
                    const canRespond =
                      role === "giving" && proposal.status === "pending";
                    const isResponding = respondingId === proposal.sp_id;
                    return (
                      <li key={proposal.sp_id} className="dashboard-list-item">
                        <span>
                          {item ? item.name : `Item #${proposal.item_id}`}
                          <span className="dashboard-list-meta"> · {role}</span>
                        </span>
                        <span className="dashboard-list-actions">
                          <span
                            className={`status-pill status-${proposal.status}`}
                          >
                            {proposal.status}
                          </span>
                          {canRespond && (
                            <>
                              <button
                                type="button"
                                className="dashboard-toggle"
                                disabled={isResponding}
                                onClick={() =>
                                  handleProposalResponse(proposal, "accepted")
                                }
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="dashboard-toggle"
                                disabled={isResponding}
                                onClick={() =>
                                  handleProposalResponse(proposal, "rejected")
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <section
            className="dashboard-panel dashboard-panel-wide"
            aria-labelledby="history-heading"
          >
            <h2 id="history-heading">Swap history ({swapHistory.length})</h2>
            {swapHistory.length === 0 ? (
              <p className="dashboard-empty">
                Completed swaps will appear here.
              </p>
            ) : (
              <div className="dashboard-section-scroll">
                <ul className="dashboard-list">
                  {swapHistory.map((history) => {
                    const item = itemsById.get(history.item_id);
                    const isGiving = history.from_user_id === user.user_id;
                    const otherUserId = isGiving
                      ? history.to_user_id
                      : history.from_user_id;
                    const otherUser =
                      namesByUserId.get(otherUserId) ?? `User #${otherUserId}`;
                    const direction = isGiving ? "Gave" : "Received";

                    return (
                      <li key={history.sh_id} className="history-item">
                        <div className="history-item-content">
                          <div className="history-item-title">
                            <strong>
                              {item ? item.name : `Item #${history.item_id}`}
                            </strong>
                            <span className="dashboard-list-meta">
                              {direction} {isGiving ? "to" : "from"} {otherUser}
                            </span>
                          </div>
                          {item?.description && (
                            <p className="history-item-description">
                              {item.description}
                            </p>
                          )}
                          {history.notes && (
                            <p className="history-item-notes">
                              {history.notes}
                            </p>
                          )}
                        </div>
                        <time
                          className="history-item-date"
                          dateTime={history.swap_date ?? undefined}
                        >
                          {formatSwapDate(history.swap_date)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
