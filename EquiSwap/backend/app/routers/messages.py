from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()


def _require_accepted_participant(cycle_id: UUID, user_id: int, db: Session) -> None:
    accepted_proposal = (
        db.query(models.SwapProposal.sp_id)
        .filter(
            models.SwapProposal.cycle_id == cycle_id,
            models.SwapProposal.giver_id == user_id,
            models.SwapProposal.status == "accepted",
        )
        .first()
    )
    if accepted_proposal is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accept your swap proposal before accessing its messages",
        )


@router.get("/cycles/{cycle_id}", response_model=list[schemas.SwapMessageRead])
def list_cycle_messages(
    cycle_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> list[dict]:
    _require_accepted_participant(cycle_id, current_user.user_id, db)
    rows = (
        db.query(models.SwapMessage, models.User.name)
        .join(models.User, models.User.user_id == models.SwapMessage.sender_id)
        .filter(models.SwapMessage.cycle_id == cycle_id)
        .order_by(models.SwapMessage.created_at, models.SwapMessage.message_id)
        .all()
    )
    return [
        {
            "message_id": message.message_id,
            "cycle_id": message.cycle_id,
            "sender_id": message.sender_id,
            "sender_name": sender_name,
            "message": message.message,
            "created_at": message.created_at,
        }
        for message, sender_name in rows
    ]


@router.post(
    "/cycles/{cycle_id}",
    response_model=schemas.SwapMessageRead,
    status_code=status.HTTP_201_CREATED,
)
def create_cycle_message(
    cycle_id: UUID,
    body: schemas.SwapMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    _require_accepted_participant(cycle_id, current_user.user_id, db)
    message_text = body.message.strip()
    if not message_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be blank",
        )

    message = models.SwapMessage(
        cycle_id=cycle_id,
        sender_id=current_user.user_id,
        message=message_text,
    )
    db.add(message)

    accepted_participants = (
        db.query(models.SwapProposal.giver_id)
        .filter(
            models.SwapProposal.cycle_id == cycle_id,
            models.SwapProposal.status == "accepted",
        )
        .distinct()
        .all()
    )
    notification_message = f"New message from {current_user.name}: {message_text[:120]}"
    for (participant_id,) in accepted_participants:
        if participant_id != current_user.user_id:
            db.add(
                models.Notification(
                    user_id=participant_id,
                    type="swap_message",
                    message=notification_message,
                    related_cycle_id=cycle_id,
                )
            )

    db.commit()
    db.refresh(message)
    return {
        "message_id": message.message_id,
        "cycle_id": message.cycle_id,
        "sender_id": message.sender_id,
        "sender_name": current_user.name,
        "message": message.message,
        "created_at": message.created_at,
    }
