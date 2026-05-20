from sqlalchemy import Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class User(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    nom: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text, default="lecteur", nullable=False)  # admin|directeur|consultant|charge|lecteur
    actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
