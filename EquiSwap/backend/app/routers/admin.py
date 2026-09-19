from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app import auth, models, schemas
from app.database import get_db

router = APIRouter()


@router.get("/users", response_model=list[schemas.AdminUserRead])
def list_users_with_items(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    return db.query(models.User).options(joinedload(models.User.items)).order_by(models.User.user_id).all()
