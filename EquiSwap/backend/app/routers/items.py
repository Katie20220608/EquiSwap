import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()

_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_UPLOAD_BYTES = 5 * 1024 * 1024

_raw_upload_dir = os.getenv("UPLOAD_DIR")
if _raw_upload_dir:
    _UPLOAD_DIR = Path(_raw_upload_dir).expanduser().resolve()


@router.post("/upload-image")
async def upload_item_image(
    file: UploadFile,
    _current_user: models.User = Depends(auth.get_current_user),
) -> dict:
    """Save an uploaded image and return its URL for use as an item's image_url."""
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=422, detail="Only JPEG, PNG, GIF, or WEBP images are allowed")

    contents = await file.read()
    if len(contents) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="Image must be smaller than 5MB")

    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename or "").suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4()}{extension}"
    (_UPLOAD_DIR / filename).write_bytes(contents)

    return {"url": f"/uploads/{filename}"}


@router.post("/", response_model=schemas.ItemRead, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: schemas.ItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    item = models.Item(owner_id=current_user.user_id, **payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail="Invalid category_id: category does not exist") from exc
    db.refresh(item)
    return item


@router.get("/", response_model=list[schemas.ItemRead])
def list_items(db: Session = Depends(get_db)):
    return db.query(models.Item).all()


@router.get("/{item_id}", response_model=schemas.ItemRead)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Item).filter(models.Item.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}", response_model=schemas.ItemRead)
def update_item(
    item_id: int,
    payload: schemas.ItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    item = db.query(models.Item).filter(models.Item.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only item owner can update item")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    item = db.query(models.Item).filter(models.Item.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only item owner can delete item")

    db.delete(item)
    db.commit()
    return None
