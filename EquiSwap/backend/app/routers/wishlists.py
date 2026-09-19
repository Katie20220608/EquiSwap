from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()


@router.post("/", response_model=schemas.WishlistRead, status_code=status.HTTP_201_CREATED)
def create_wishlist_entry(
    payload: schemas.WishlistCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    item = db.query(models.Item).filter(models.Item.item_id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = (
        db.query(models.Wishlist)
        .filter(
            models.Wishlist.user_id == current_user.user_id,
            models.Wishlist.item_id == payload.item_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Item already in wishlist")

    entry = models.Wishlist(user_id=current_user.user_id, item_id=payload.item_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/", response_model=list[schemas.WishlistRead])
def list_my_wishlist(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return db.query(models.Wishlist).filter(models.Wishlist.user_id == current_user.user_id).all()


@router.delete("/{wishlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wishlist_entry(
    wishlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    entry = db.query(models.Wishlist).filter(models.Wishlist.wishlist_id == wishlist_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Wishlist entry not found")
    if entry.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own wishlist entries")

    db.delete(entry)
    db.commit()
    return None
