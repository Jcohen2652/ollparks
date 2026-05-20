import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Interaction(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "interactions"

    type: Mapped[str | None] = mapped_column(Text)
    direction: Mapped[str | None] = mapped_column(Text)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), index=True
    )
    entreprise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entreprises.id"), index=True
    )
    bien_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("biens.id"))
    sujet: Mapped[str | None] = mapped_column(Text)
    contenu: Mapped[str | None] = mapped_column(Text)
    outlook_msg_id: Mapped[str | None] = mapped_column(Text, unique=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
