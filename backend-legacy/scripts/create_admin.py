"""
Crée un compte admin initial.

Usage: python -m scripts.create_admin admin@oll-parks.fr motdepasse
"""

import sys

from sqlalchemy import select

from api.db import SessionLocal
from api.models import User
from api.services.auth import hash_password


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python -m scripts.create_admin <email> <password>")
        sys.exit(1)
    email, password = sys.argv[1], sys.argv[2]
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            existing.password_hash = hash_password(password)
            existing.role = "admin"
            existing.actif = True
            db.commit()
            print(f"✅ Admin {email} mis à jour")
            return
        user = User(email=email, password_hash=hash_password(password), role="admin")
        db.add(user)
        db.commit()
        print(f"✅ Admin {email} créé")


if __name__ == "__main__":
    main()
