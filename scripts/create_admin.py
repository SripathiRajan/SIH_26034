"""Seed an admin/auditor user. Admins cannot self-register (P1 role lock).

Usage:
    python scripts/create_admin.py --username admin --email admin@gov.in --password <secret> --role admin
"""
import argparse
import uuid
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal, create_tables
from core.db_models import UserDB
from core.auth import hash_password

VALID_ROLES = {"admin", "auditor", "inspector"}


def main():
    p = argparse.ArgumentParser(description="Create a privileged PRAMAN user")
    p.add_argument("--username", required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--role", default="admin", choices=sorted(VALID_ROLES))
    args = p.parse_args()

    if len(args.password) < 8:
        sys.exit("Error: password must be at least 8 characters")

    create_tables()
    db = SessionLocal()
    try:
        if db.query(UserDB).filter((UserDB.username == args.username) | (UserDB.email == args.email)).first():
            sys.exit("Error: user already exists")
        db.add(UserDB(
            id=uuid.uuid4().hex,
            username=args.username,
            email=args.email,
            hashed_password=hash_password(args.password),
            full_name=args.username,
            role=args.role,
        ))
        db.commit()
        print(f"Created {args.role} user: {args.username} ({args.email})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
