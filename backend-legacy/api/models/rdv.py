import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Rdv(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "rdv"

    titre: Mapped[str | None] = mapped_column(Text)
    debut: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lieu: Mapped[str | None] = mapped_column(Text)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id")
    )
    entreprise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entreprises.id")
    )
    bien_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("biens.id"))
    outlook_event_id: Mapped[str | None] = mapped_column(Text, unique=True)
    rappel_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    statut: Mapped[str] = mapped_column(Text, default="planifié", nullable=False)
