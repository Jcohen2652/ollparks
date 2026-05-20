import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Proprietaire(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "proprietaires"

    type: Mapped[str | None] = mapped_column(Text)
    nom: Mapped[str] = mapped_column(Text, nullable=False)
    siren: Mapped[str | None] = mapped_column(String(9))
    pappers_id: Mapped[str | None] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    contact_principal: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id")
    )


class BienProprietaire(Base):
    __tablename__ = "biens_proprietaires"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="CASCADE"), primary_key=True
    )
    proprietaire_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("proprietaires.id", ondelete="CASCADE"),
        primary_key=True,
    )
    quote_part: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
