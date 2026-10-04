from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, or_
from sqlalchemy.orm import Session, joinedload

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()


@router.get("/users", response_model=list[schemas.AdminUserRead])
def list_users_with_items(
    q: str | None = Query(default=None, max_length=100),
    role: str | None = Query(default=None, max_length=20),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(active|suspended)$"),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    query = db.query(models.User).options(joinedload(models.User.items))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(models.User.name.ilike(like), models.User.email.ilike(like)))
    if role:
        query = query.filter(models.User.role == role)
    if status_filter:
        query = query.filter(models.User.is_active.is_(status_filter == "active"))
    return query.order_by(models.User.user_id).all()


def _get_user_or_404(db: Session, user_id: int) -> models.User:
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users/{user_id}", response_model=schemas.AdminUserDetail)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    user = _get_user_or_404(db, user_id)
    proposals = db.query(models.SwapProposal)
    counts = schemas.AdminSwapCounts(
        given=proposals.filter(models.SwapProposal.giver_id == user_id).count(),
        received=proposals.filter(models.SwapProposal.receiver_id == user_id).count(),
        completed=db.query(models.SwapHistory)
        .filter(or_(models.SwapHistory.from_user_id == user_id, models.SwapHistory.to_user_id == user_id))
        .count(),
        rejected=proposals.filter(
            or_(models.SwapProposal.giver_id == user_id, models.SwapProposal.receiver_id == user_id),
            models.SwapProposal.status == "rejected",
        ).count(),
    )
    logs = (
        db.query(models.TrustLog)
        .filter(models.TrustLog.user_id == user_id)
        .order_by(models.TrustLog.tl_id.desc())
        .limit(10)
        .all()
    )
    return schemas.AdminUserDetail(
        user=user,
        items=db.query(models.Item)
        .filter(models.Item.owner_id == user_id)
        .order_by(models.Item.item_id)
        .all(),
        swap_counts=counts,
        wishlist_count=db.query(models.Wishlist).filter(models.Wishlist.user_id == user_id).count(),
        recent_trust_logs=logs,
    )


@router.patch("/users/{user_id}/status", response_model=schemas.UserRead)
def set_user_status(
    user_id: int,
    payload: schemas.AdminUserStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    user = _get_user_or_404(db, user_id)
    if user.user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts cannot be suspended")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


STALE_PENDING_DAYS = 3


def _cycle_outcome(proposals: list[models.SwapProposal]) -> str:
    statuses = {p.status for p in proposals}
    if statuses == {"accepted"}:
        return "completed"
    for outcome in ("rejected", "expired", "cancelled"):
        if outcome in statuses:
            return outcome
    return "pending"


@router.get("/swap-insights", response_model=schemas.AdminSwapInsights)
def get_swap_insights(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    cycles: dict = defaultdict(list)
    for p in db.query(models.SwapProposal).all():
        cycles[p.cycle_id].append(p)

    outcome_counts: Counter = Counter()
    length_total: Counter = Counter()
    length_completed: Counter = Counter()
    durations: list[float] = []
    stale = 0
    stale_cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=STALE_PENDING_DAYS)

    for proposals in cycles.values():
        outcome = _cycle_outcome(proposals)
        length = len(proposals)
        outcome_counts[outcome] += 1
        length_total[length] += 1
        created = min((p.created_at for p in proposals if p.created_at), default=None)
        if outcome == "completed":
            length_completed[length] += 1
            responded = max((p.responded_at for p in proposals if p.responded_at), default=None)
            if created and responded:
                durations.append((responded - created).total_seconds() / 3600)
        elif outcome == "pending" and created and created < stale_cutoff:
            stale += 1

    total = len(cycles)
    completed = outcome_counts["completed"]
    reasons = Counter(
        p.rejection_reason.strip()
        for proposals in cycles.values()
        for p in proposals
        if p.status == "rejected" and p.rejection_reason and p.rejection_reason.strip()
    )

    return schemas.AdminSwapInsights(
        total_cycles=total,
        completed_cycles=completed,
        success_rate=round(completed / total, 3) if total else 0.0,
        average_cycle_length=round(sum(length_total.elements()) / total, 2) if total else 0.0,
        average_hours_to_complete=round(sum(durations) / len(durations), 1) if durations else None,
        outcome_counts=dict(outcome_counts),
        by_length=[
            schemas.CycleLengthStat(
                length=n,
                total=length_total[n],
                completed=length_completed[n],
                success_rate=round(length_completed[n] / length_total[n], 3),
            )
            for n in sorted(length_total)
        ],
        top_rejection_reasons=[
            schemas.RejectionReasonStat(reason=r, count=c) for r, c in reasons.most_common(5)
        ],
        stale_pending_cycles=stale,
    )


STATS_WINDOW_DAYS = 14


def _daily_series(timestamps, today: date) -> list[schemas.DailyCount]:
    counts = Counter(ts.date() for (ts,) in timestamps if ts is not None)
    days = [today - timedelta(days=i) for i in range(STATS_WINDOW_DAYS - 1, -1, -1)]
    return [schemas.DailyCount(day=d, count=counts.get(d, 0)) for d in days]


@router.get("/stats", response_model=schemas.AdminStatsRead)
def get_platform_stats(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    now = datetime.now(UTC).replace(tzinfo=None)
    today = now.date()
    window_start = datetime.combine(today - timedelta(days=STATS_WINDOW_DAYS - 1), datetime.min.time())
    week_start = now - timedelta(days=7)

    status_counts = dict(
        db.query(models.SwapProposal.status, func.count(distinct(models.SwapProposal.cycle_id)))
        .group_by(models.SwapProposal.status)
        .all()
    )
    open_swaps = (
        db.query(func.count(distinct(models.SwapProposal.cycle_id)))
        .filter(models.SwapProposal.status.in_(("pending", "accepted")))
        .scalar()
        or 0
    )
    completed_swaps = db.query(func.count(distinct(models.SwapHistory.cycle_id))).scalar() or 0

    signups = db.query(models.User.created_at).filter(models.User.created_at >= window_start).all()
    swaps = db.query(models.SwapHistory.swap_date).filter(models.SwapHistory.swap_date >= window_start).all()

    item_counts = dict(
        db.query(models.Item.category_id, func.count(models.Item.item_id))
        .group_by(models.Item.category_id)
        .all()
    )
    wish_counts = dict(
        db.query(models.Item.category_id, func.count(models.Wishlist.wishlist_id))
        .join(models.Wishlist, models.Wishlist.item_id == models.Item.item_id)
        .group_by(models.Item.category_id)
        .all()
    )
    categories = {c.c_id: c.c_name for c in db.query(models.Category).all()}
    top_categories = sorted(
        (
            schemas.CategoryStat(
                category=categories.get(cid, "Uncategorised"),
                items=item_counts.get(cid, 0),
                wishlists=wish_counts.get(cid, 0),
            )
            for cid in set(item_counts) | set(wish_counts)
        ),
        key=lambda c: (c.items + c.wishlists, c.category),
        reverse=True,
    )[:5]

    return schemas.AdminStatsRead(
        total_users=db.query(func.count(models.User.user_id)).scalar() or 0,
        new_users_7d=db.query(func.count(models.User.user_id))
        .filter(models.User.created_at >= week_start)
        .scalar()
        or 0,
        total_items=db.query(func.count(models.Item.item_id)).scalar() or 0,
        available_items=db.query(func.count(models.Item.item_id))
        .filter(models.Item.status == "available")
        .scalar()
        or 0,
        open_swaps=open_swaps,
        completed_swaps=completed_swaps,
        proposal_status_counts=status_counts,
        signups_per_day=_daily_series(signups, today),
        swaps_per_day=_daily_series(swaps, today),
        top_categories=top_categories,
    )
