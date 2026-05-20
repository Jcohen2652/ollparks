import uuid
from typing import Any

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Document(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "documents"

    type: Mapped[str | None] = mapped_column(Text)
    bien_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("biens.id"))
    entreprise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entreprises.id")
    )
    opportunite_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("opportunites.id")
    )
    storage_url: Mapped[str | None] = mapped_column(Text)
    template_id: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    statut: Mapped[str] = mapped_column(Text, default="brouillon", nullable=False)
