from decimal import Decimal

from sqlalchemy import Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Entreprise(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "entreprises"

    siren: Mapped[str | None] = mapped_column(String(9), unique=True, index=True)
    raison_sociale: Mapped[str] = mapped_column(Text, nullable=False)
    secteur: Mapped[str | None] = mapped_column(Text)
    effectif: Mapped[int | None] = mapped_column(Integer)
    ca: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    site_web: Mapped[str | None] = mapped_column(Text)
    linkedin_url: Mapped[str | None] = mapped_column(Text)
    pappers_id: Mapped[str | None] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
