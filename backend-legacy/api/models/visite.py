import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Visite(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "visites"

    bien_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id")
    )
    opportunite_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("opportunites.id")
    )
    date_visite: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    statut: Mapped[str] = mapped_column(Text, default="planifiée", nullable=False)
    bon_de_visite_url: Mapped[str | None] = mapped_column(Text)
    denonce_url: Mapped[str | None] = mapped_column(Text)
    modalites_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class VisiteParticipant(Base):
    __tablename__ = "visites_participants"

    visite_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visites.id", ondelete="CASCADE"), primary_key=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str | None] = mapped_column(Text)
