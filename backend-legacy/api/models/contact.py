import uuid

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Contact(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "contacts"

    entreprise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("entreprises.id", ondelete="SET NULL"), index=True
    )
    prenom: Mapped[str | None] = mapped_column(Text)
    nom: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text, index=True)
    telephone: Mapped[str | None] = mapped_column(Text)
    poste: Mapped[str | None] = mapped_column(Text)
    role_immo: Mapped[str | None] = mapped_column(Text)
    linkedin_url: Mapped[str | None] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source: Mapped[str | None] = mapped_column(Text)
