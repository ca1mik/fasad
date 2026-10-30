from __future__ import annotations

from sqlalchemy import select

from app.core import lan_credentials
from app.core.security import hash_password
from app.modules.users.models import User


def test_lan_requires_demo_passwords_to_be_changed(db_session, monkeypatch):
    monkeypatch.setattr(lan_credentials, "SessionLocal", lambda: db_session)

    assert lan_credentials.main() == 1

    admin = db_session.scalar(select(User).where(User.login == "admin"))
    assert admin is not None
    admin.password_hash = hash_password("new-private-password")
    db_session.commit()

    assert lan_credentials.main() == 0
