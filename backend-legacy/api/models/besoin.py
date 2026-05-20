import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Besoin(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "besoins"

    entreprise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entreprises.id", ondelete="CASCADE"), index=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL")
    )
    typologie: Mapped[str | None] = mapped_column(Text)
    transaction: Mapped[str | None] = mapped_column(Text)
    surface_min: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    surface_max: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    budget_min: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    budget_max: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    zones: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    timing: Mapped[str | None] = mapped_column(Text)
    statut: Mapped[str] = mapped_column(Text, default="actif", nullable=False)
