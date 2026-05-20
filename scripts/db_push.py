#!/usr/bin/env python3
"""
Pousse les migrations supabase/migrations/*.sql dans la base distante.

Usage : DATABASE_URL=postgresql://... python3 scripts/db_push.py [--include-seed]

Sans CLI Supabase requise — juste psycopg.
"""

import argparse
import os
import sys
from pathlib import Path

import psycopg


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--include-seed", action="store_true", help="Inclure les fichiers _seed.sql")
    parser.add_argument("--skip", nargs="*", default=[], help="Patterns à ignorer")
    args = parser.parse_args()

    url = os.environ.get("DATABASE_URL")
    if not url:
        # essaie de lire .env.local
        env_path = Path(__file__).parent.parent / ".env.local"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("DATABASE_URL="):
                    url = line.split("=", 1)[1].strip().strip('"')
                    break
    if not url:
        print("❌ DATABASE_URL manquante (ENV ou .env.local)", file=sys.stderr)
        sys.exit(1)

    mig_dir = Path(__file__).parent.parent / "supabase" / "migrations"
    files = sorted(mig_dir.glob("*.sql"))
    if not args.include_seed:
        files = [f for f in files if "_seed" not in f.name]
    files = [f for f in files if not any(p in f.name for p in args.skip)]

    print(f"🔌 Connexion à {url.split('@')[1].split('/')[0]}")
    with psycopg.connect(url, sslmode="require", connect_timeout=30, autocommit=True) as conn:
        for f in files:
            print(f"▶ {f.name}")
            try:
                with conn.cursor() as cur:
                    cur.execute(f.read_text())
                print(f"  ✅ OK")
            except Exception as e:
                print(f"  ❌ {type(e).__name__}: {str(e)[:300]}", file=sys.stderr)
                sys.exit(1)
    print("\n✨ Migrations terminées")


if __name__ == "__main__":
    main()
