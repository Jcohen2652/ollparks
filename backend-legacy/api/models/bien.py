from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base
from api.models._mixins import TimestampsMixin, UUIDMixin


class Bien(UUIDMixin, TimestampsMixin, Base):
    __tablename__ = "biens"

    reference: Mapped[str | None] = mapped_column(Text, unique=True)
    typologie: Mapped[str | None] = mapped_column(Text, index=True)
    statut: Mapped[str] = mapped_column(Text, default="disponible", nullable=False)
    transaction: Mapped[str | None] = mapped_column(Text)
    surface_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    prix: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    loyer_annuel: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    adresse: Mapped[str | None] = mapped_column(Text)
    ville: Mapped[str | None] = mapped_column(Text)
    code_postal: Mapped[str | None] = mapped_column(String(10))
    pays: Mapped[str] = mapped_column(Text, default="France", nullable=False)
    geom: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))
    off_market: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mandat_interne: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    visial_qie_id: Mapped[str | None] = mapped_column(Text)
