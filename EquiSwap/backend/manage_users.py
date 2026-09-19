"""List users, or reset a user's password (passwords are hashed and cannot be recovered).

Usage (run from EquiSwap/backend):
    python3 manage_users.py list
    python3 manage_users.py reset-password --email alice@example.com --new-password "NewPass123"
"""

import argparse

from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import User


def list_users(db):
    users = db.query(User).order_by(User.user_id).all()
    if not users:
        print("No users found.")
        return
    for user in users:
        print(
            f"user_id={user.user_id} name={user.name!r} email={user.email!r} "
            f"role={user.role} is_active={user.is_active} trust_score={user.trust_score}"
        )


def reset_password(db, email: str, new_password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"No user found with email={email!r}")
        return
    user.password_hash = get_password_hash(new_password)
    db.commit()
    print(f"Password updated for user_id={user.user_id} email={user.email!r}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="List all users (no password data is ever shown)")

    reset_parser = subparsers.add_parser("reset-password", help="Set a new password for a user")
    reset_parser.add_argument("--email", required=True)
    reset_parser.add_argument("--new-password", required=True)

    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.command == "list":
            list_users(db)
        elif args.command == "reset-password":
            reset_password(db, args.email, args.new_password)
    finally:
        db.close()


if __name__ == "__main__":
    main()
