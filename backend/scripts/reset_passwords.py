"""Reseta senhas dos usuários seed para os valores padrão."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.models.user import User
from app.auth.passwords import hash_password

RESETS = [
    ("gestor@joytec.com", "gestor123"),
    ("consultor@joytec.com", "consultor123"),
    ("admin@joytec.com", "admin123"),
]

db = SessionLocal()
for email, password in RESETS:
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.password_hash = hash_password(password)
        print(f"  senha resetada: {email}")
    else:
        print(f"  não encontrado: {email}")

db.commit()
db.close()
print("Reset concluído.")
