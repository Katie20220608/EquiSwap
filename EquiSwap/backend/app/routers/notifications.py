from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()


@router.get("/", response_model=list[schemas.NotificationRead])
def list_my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[models.Notification]:
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.user_id)
    if unread_only:
        query = query.filter(models.Notification.is_read.is_(False))
    return query.order_by(models.Notification.created_at.desc()).all()


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.user_id,
            models.Notification.is_read.is_(False),
        )
        .count()
    )
    return {"unread_count": count}


@router.patch("/{n_id}/read", response_model=schemas.NotificationRead)
def mark_notification_read(
    n_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> models.Notification:
    notification = db.query(models.Notification).filter(models.Notification.n_id == n_id).first()
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your notification")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.patch("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    updated = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.user_id,
            models.Notification.is_read.is_(False),
        )
        .update({"is_read": True})
    )
    db.commit()
    return {"updated": updated}
