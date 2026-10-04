from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()


@router.post("/", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=auth.get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=list[schemas.UserRead])
def list_users(db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_user)):
    return db.query(models.User).all()


@router.get("/directory", response_model=list[schemas.UserDirectoryEntry])
def list_user_directory(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Minimal user list (id + name only) for pickers like blacklist management."""
    return db.query(models.User).filter(models.User.user_id != current_user.user_id).all()


@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.get_current_user)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}/trust", response_model=schemas.TrustScoreRead)
def get_trust_score(
    user_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_current_user),
):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    history = (
        db.query(models.TrustLog)
        .filter(models.TrustLog.user_id == user_id)
        .order_by(models.TrustLog.logged_at.desc())
        .all()
    )
    return schemas.TrustScoreRead(
        user_id=user.user_id,
        trust_score=user.trust_score,
        rejection_count=user.rejection_count,
        history=history,
    )


@router.put("/{user_id}", response_model=schemas.UserRead)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own profile")

    if payload.name is not None:
        user.name = payload.name
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own profile")

    db.delete(user)
    db.commit()
    return None
