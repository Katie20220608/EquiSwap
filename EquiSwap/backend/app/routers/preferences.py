from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()


def _to_read(entry: models.UserPreference) -> schemas.PreferenceRead:
    data = schemas.PreferenceRead.model_validate(entry)
    data.avoid_user_name = entry.avoid_user.name if entry.avoid_user else None
    return data


@router.get("/", response_model=list[schemas.PreferenceRead])
def list_my_preferences(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entries = (
        db.query(models.UserPreference).filter(models.UserPreference.user_id == current_user.user_id).all()
    )
    return [_to_read(entry) for entry in entries]


@router.post("/", response_model=schemas.PreferenceRead, status_code=status.HTTP_201_CREATED)
def create_preference(
    payload: schemas.PreferenceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if payload.avoid_user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot blacklist yourself")

    avoid_user = db.query(models.User).filter(models.User.user_id == payload.avoid_user_id).first()
    if not avoid_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(models.UserPreference)
        .filter(
            models.UserPreference.user_id == current_user.user_id,
            models.UserPreference.avoid_user_id == payload.avoid_user_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already blacklisted")

    entry = models.UserPreference(
        user_id=current_user.user_id,
        avoid_user_id=payload.avoid_user_id,
        reason=payload.reason,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_read(entry)


@router.delete("/{uf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preference(
    uf_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = db.query(models.UserPreference).filter(models.UserPreference.uf_id == uf_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Blacklist entry not found")
    if entry.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only remove your own blacklist entries")

    db.delete(entry)
    db.commit()
    return None
