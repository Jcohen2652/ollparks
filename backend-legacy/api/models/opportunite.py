import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Opportunite(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "opportunites"
    __table_args__ = (UniqueConstraint("besoin_id", "bien_id", name="uq_opp_besoin_bien"),)

    besoin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("besoins.id", ondelete="CASCADE"), index=True
    )
    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biens.id", ondelete="CASCADE"), index=True
    )
    score: Mapped[int | None] = mapped_column(Integer, index=True)
    score_detail: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    statut: Mapped[str] = mapped_column(Text, default="nouveau", nullable=False)
    action_recommandee: Mapped[str | None] = mapped_column(Text)
