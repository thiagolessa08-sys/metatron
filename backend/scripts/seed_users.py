"""Cria usuários iniciais de dev. Rodar apenas uma vez após alembic upgrade head."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, engine
from app.models.user import User, Role
from app.auth.passwords import hash_password
from app.database import Base

Base.metadata.create_all(bind=engine)

SEED_USERS = [
    {"email": "gestor@joytec.com", "password": "gestor123", "role": Role.gestor},
    {"email": "consultor@joytec.com", "password": "consultor123", "role": Role.consultor},
    {"email": "admin@joytec.com", "password": "admin123", "role": Role.admin},
]

db = SessionLocal()
for u in SEED_USERS:
    existing = db.query(User).filter(User.email == u["email"]).first()
    if existing:
        print(f"  já existe: {u['email']}")
        continue
    user = User(email=u["email"], password_hash=hash_password(u["password"]), role=u["role"])
    db.add(user)
    print(f"  criado: {u['email']} ({u['role']})")

db.commit()
db.close()
print("Seed concluído.")
