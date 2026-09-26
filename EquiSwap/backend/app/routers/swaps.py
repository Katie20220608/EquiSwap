import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db
from app.graph import build_swap_graph, find_elementary_cycles, get_blocked_pairs, preference_pair
from app.tarjan import TarjanSCC

router = APIRouter()

_TRUST_DELTA_REJECT = -5
_TRUST_DELTA_COMPLETE = 5
_PROPOSAL_EXPIRY_HOURS = 24
_EXPIRY_WARNING_WINDOW_HOURS = 1


def _cancel_cycle(cycle_id: uuid.UUID, db: Session) -> None:
    """Set all non-final proposals for a cycle to cancelled and free their items."""
    proposals = db.query(models.SwapProposal).filter(models.SwapProposal.cycle_id == cycle_id).all()
    for p in proposals:
        item = db.query(models.Item).filter(models.Item.item_id == p.item_id).first()
        if item and item.status == "swap_pending":
            item.status = "available"
        if p.status not in ("rejected", "cancelled", "expired"):
            p.status = "cancelled"


def _execute_swap(cycle_id: uuid.UUID, proposals: list, db: Session) -> None:
    """Transfer ownership, write history rows, and reward trust for all participants."""
    participant_ids: set[int] = set()
    for p in proposals:
        item = db.query(models.Item).filter(models.Item.item_id == p.item_id).first()
        if item:
            item.owner_id = p.receiver_id
            item.status = "swapped"
        db.add(
            models.SwapHistory(
                item_id=p.item_id,
                from_user_id=p.giver_id,
                to_user_id=p.receiver_id,
                cycle_id=cycle_id,
            )
        )
        participant_ids.update([p.giver_id, p.receiver_id])

    for uid in participant_ids:
        user = db.query(models.User).filter(models.User.user_id == uid).first()
        if user:
            user.trust_score = max(0, min(200, user.trust_score + _TRUST_DELTA_COMPLETE))
        db.add(
            models.TrustLog(
                user_id=uid,
                action="completed_swap",
                score_change=_TRUST_DELTA_COMPLETE,
                description=f"Completed swap cycle {cycle_id}",
            )
        )
        db.add(
            models.Notification(
                user_id=uid,
                type="swap_completed",
                message="Your swap cycle has been completed. Items have been transferred.",
                related_cycle_id=cycle_id,
            )
        )


def process_expirations(db: Session) -> dict:
    """Sweep pending proposals: warn about ones expiring soon, expire and cancel overdue ones.

    Meant to be called periodically (background task or external scheduler) so
    that proposals nobody responds to don't sit stale forever.
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    warning_cutoff = now + timedelta(hours=_EXPIRY_WARNING_WINDOW_HOURS)

    pending = (
        db.query(models.SwapProposal)
        .filter(models.SwapProposal.status == "pending", models.SwapProposal.expires_at.isnot(None))
        .all()
    )

    warned = 0
    expired_cycles: set[uuid.UUID] = set()
    for p in pending:
        if p.expires_at <= now:
            if p.cycle_id not in expired_cycles:
                p.status = "expired"
                _cancel_cycle(p.cycle_id, db)
                expired_cycles.add(p.cycle_id)

                cycle_proposals = (
                    db.query(models.SwapProposal).filter(models.SwapProposal.cycle_id == p.cycle_id).all()
                )
                participant_ids = {cp.giver_id for cp in cycle_proposals} | {
                    cp.receiver_id for cp in cycle_proposals
                }
                for uid in participant_ids:
                    db.add(
                        models.Notification(
                            user_id=uid,
                            type="swap_expired",
                            message="Your swap proposal expired without a response and was cancelled.",
                            related_cycle_id=p.cycle_id,
                        )
                    )
        elif p.expires_at <= warning_cutoff and not p.expiry_warning_sent:
            p.expiry_warning_sent = True
            warned += 1
            db.add(
                models.Notification(
                    user_id=p.giver_id,
                    type="swap_expiring_soon",
                    message="Your swap proposal expires in less than an hour. Please respond soon.",
                    related_cycle_id=p.cycle_id,
                )
            )

    db.commit()
    return {"expired_cycles": len(expired_cycles), "warnings_sent": warned}


@router.post("/process-expirations")
def process_expirations_endpoint(db: Session = Depends(get_db)) -> dict:
    """Trigger the expiry sweep on demand (intended for a scheduler/cron job)."""
    return process_expirations(db)


@router.get("/find/{user_id}")
def find_swap_cycles(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    graph = build_swap_graph(db)
    sccs = TarjanSCC(graph).cycles()

    # An SCC only guarantees every member can reach every other member, not
    # that a single Hamiltonian cycle exists through all of them (e.g. two
    # triangles sharing one node). Decompose each SCC into elementary cycles
    # so every cycle returned here can actually be proposed as-is.
    user_cycles: list[list[int]] = []
    cycle_item_ids: list[list[int | None]] = []
    seen: set[tuple[int, ...]] = set()
    for scc in sccs:
        if user_id not in scc:
            continue
        for cycle in find_elementary_cycles(graph, nodes=set(scc)):
            if user_id not in cycle:
                continue
            key = tuple(cycle)
            if key in seen:
                continue
            seen.add(key)
            user_cycles.append(cycle)
            item_ids: list[int | None] = []
            for index, wisher_id in enumerate(cycle):
                owner_id = cycle[(index + 1) % len(cycle)]
                item = (
                    db.query(models.Item.item_id)
                    .join(models.Wishlist, models.Wishlist.item_id == models.Item.item_id)
                    .filter(
                        models.Wishlist.user_id == wisher_id,
                        models.Item.owner_id == owner_id,
                        models.Item.status == "available",
                    )
                    .first()
                )
                item_ids.append(item.item_id if item else None)
            cycle_item_ids.append(item_ids)

    return {"user_id": user_id, "cycles": user_cycles, "cycle_item_ids": cycle_item_ids}


@router.get("/mine", response_model=list[schemas.SwapProposalRead])
def list_my_proposals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[models.SwapProposal]:
    """List swap proposals relevant to the current user.

    Admins can review all proposals; other users only see proposals where they
    are directly involved as giver or receiver.
    """
    query = db.query(models.SwapProposal)
    if current_user.role != "admin":
        query = query.filter(
            (models.SwapProposal.giver_id == current_user.user_id)
            | (models.SwapProposal.receiver_id == current_user.user_id)
        )
    return query.order_by(models.SwapProposal.created_at.desc()).all()


def _find_cycle_edges(user_ids: list[int], db: Session) -> list[tuple[int, int, int]] | None:
    """Find a Hamiltonian cycle of wishlist edges covering exactly `user_ids`.

    Tarjan returns an SCC, not a guaranteed edge-by-edge ordering, and a greedy
    single-path walk can dead-end even when a valid cycle exists. Backtrack
    over candidate items at each step instead of committing to the first match.
    """
    cycle_users = set(user_ids)
    start_user_id = user_ids[0]
    blocked_pairs = get_blocked_pairs(db)

    def backtrack(
        wisher_id: int, visited: set[int], edges: list[tuple[int, int, int]]
    ) -> list[tuple[int, int, int]] | None:
        if len(visited) == len(user_ids):
            return edges

        possible_owners = cycle_users - visited - {wisher_id}
        is_last_step = len(visited) == len(user_ids) - 1
        if is_last_step:
            possible_owners.add(start_user_id)

        rows = (
            db.query(models.Wishlist, models.Item)
            .join(models.Item, models.Wishlist.item_id == models.Item.item_id)
            .filter(
                models.Wishlist.user_id == wisher_id,
                models.Item.owner_id.in_(possible_owners),
                models.Item.status == "available",
            )
            .all()
        )

        for _, item in rows:
            owner_id = item.owner_id
            if preference_pair(wisher_id, owner_id) in blocked_pairs:
                continue
            if owner_id == start_user_id and not is_last_step:
                continue
            result = backtrack(
                owner_id,
                visited | {wisher_id},
                edges + [(owner_id, wisher_id, item.item_id)],
            )
            if result is not None:
                return result
        return None

    return backtrack(start_user_id, set(), [])


def _learn_rejection_preferences(
    proposal: models.SwapProposal,
    rejection_reason: str | None,
    db: Session,
) -> None:
    """Avoid proposing future cycles to the participants a user rejected."""
    participant_ids = {
        user_id
        for giver_id, receiver_id in db.query(
            models.SwapProposal.giver_id,
            models.SwapProposal.receiver_id,
        )
        .filter(models.SwapProposal.cycle_id == proposal.cycle_id)
        .all()
        for user_id in (giver_id, receiver_id)
    }
    learned_reason = "Learned from rejected swap"
    if rejection_reason:
        learned_reason = f"Rejected swap: {rejection_reason}"[:100]

    for participant_id in participant_ids - {proposal.giver_id}:
        exists = (
            db.query(models.UserPreference.uf_id)
            .filter(
                models.UserPreference.user_id == proposal.giver_id,
                models.UserPreference.avoid_user_id == participant_id,
            )
            .first()
        )
        if not exists:
            db.add(
                models.UserPreference(
                    user_id=proposal.giver_id,
                    avoid_user_id=participant_id,
                    reason=learned_reason,
                )
            )


@router.post(
    "/propose",
    status_code=status.HTTP_201_CREATED,
    response_model=list[schemas.SwapProposalRead],
)
def propose_swap(
    body: schemas.SwapProposeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[models.SwapProposal]:
    """Create swap proposals for every edge in a detected cycle."""
    user_ids = body.user_ids
    if len(user_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cycle must contain at least 2 users",
        )
    if len(set(user_ids)) != len(user_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cycle must not contain duplicate user IDs",
        )
    if current_user.user_id not in user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be part of the swap cycle",
        )

    edges = _find_cycle_edges(user_ids, db)
    if edges is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(f"No closed swap cycle could be formed for users {user_ids}"),
        )

    cycle_id = uuid.uuid4()
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=_PROPOSAL_EXPIRY_HOURS)

    created: list[models.SwapProposal] = []
    for giver_id, receiver_id, item_id in edges:
        db.query(models.Item).filter(models.Item.item_id == item_id).update({"status": "swap_pending"})
        proposal = models.SwapProposal(
            cycle_id=cycle_id,
            giver_id=giver_id,
            receiver_id=receiver_id,
            item_id=item_id,
            expires_at=expires_at,
        )
        db.add(proposal)
        created.append(proposal)

    for uid in user_ids:
        db.add(
            models.Notification(
                user_id=uid,
                type="swap_proposal",
                message=(
                    "You have been matched in a swap cycle. Please review and respond to your proposal."
                ),
                related_cycle_id=cycle_id,
            )
        )

    db.commit()
    for p in created:
        db.refresh(p)
    return created


@router.patch("/{sp_id}/respond", response_model=schemas.SwapProposalRead)
def respond_to_proposal(
    sp_id: int,
    body: schemas.SwapRespondRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> models.SwapProposal:
    """Accept or reject a swap proposal; auto-executes the swap when all accept."""
    proposal = db.query(models.SwapProposal).filter(models.SwapProposal.sp_id == sp_id).first()
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found")

    if proposal.giver_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the giver can respond to this proposal",
        )

    now = datetime.now(UTC).replace(tzinfo=None)

    # Check expiry before anything else
    if proposal.expires_at and proposal.expires_at < now:
        if proposal.status == "pending":
            proposal.status = "expired"
            _cancel_cycle(proposal.cycle_id, db)
            db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This proposal has expired")

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Proposal is already '{proposal.status}'",
        )

    proposal.status = body.decision
    proposal.responded_at = now
    if body.rejection_reason is not None:
        proposal.rejection_reason = body.rejection_reason

    cycle_id = proposal.cycle_id

    if body.decision == "rejected":
        _cancel_cycle(cycle_id, db)
        _learn_rejection_preferences(proposal, body.rejection_reason, db)

        current_user.rejection_count += 1
        current_user.trust_score = max(0, min(200, current_user.trust_score + _TRUST_DELTA_REJECT))
        db.add(
            models.TrustLog(
                user_id=current_user.user_id,
                action="rejected_swap",
                score_change=_TRUST_DELTA_REJECT,
                description=f"Rejected swap cycle {cycle_id}",
            )
        )

        # Notify every other participant
        all_proposals = db.query(models.SwapProposal).filter(models.SwapProposal.cycle_id == cycle_id).all()
        notified: set[int] = {current_user.user_id}
        for p in all_proposals:
            for uid in (p.giver_id, p.receiver_id):
                if uid not in notified:
                    db.add(
                        models.Notification(
                            user_id=uid,
                            type="swap_response",
                            message=("A participant rejected the swap. The cycle has been cancelled."),
                            related_cycle_id=cycle_id,
                        )
                    )
                    notified.add(uid)

    else:  # accepted
        all_proposals = db.query(models.SwapProposal).filter(models.SwapProposal.cycle_id == cycle_id).all()
        if all(p.status == "accepted" for p in all_proposals):
            _execute_swap(cycle_id, all_proposals, db)

    db.commit()
    db.refresh(proposal)
    return proposal


@router.get("/cycles/{cycle_id}", response_model=list[schemas.SwapProposalRead])
def get_swap_cycle(
    cycle_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[models.SwapProposal]:
    proposals = db.query(models.SwapProposal).filter(models.SwapProposal.cycle_id == cycle_id).all()
    if not proposals:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Swap cycle not found")

    participant_ids = {p.giver_id for p in proposals} | {p.receiver_id for p in proposals}
    if current_user.user_id not in participant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a cycle participant")
    return proposals


@router.get("/history", response_model=list[schemas.SwapHistoryRead])
def get_swap_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[models.SwapHistory]:
    return (
        db.query(models.SwapHistory)
        .filter(
            (models.SwapHistory.from_user_id == current_user.user_id)
            | (models.SwapHistory.to_user_id == current_user.user_id)
        )
        .order_by(models.SwapHistory.swap_date.desc())
        .all()
    )
