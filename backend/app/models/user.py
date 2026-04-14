from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class UserRole(str, enum.Enum):
    SALES_OFFICER = "SALES_OFFICER"
    UNDERWRITER = "UNDERWRITER"
    HBD = "HBD"
    MD_CEO = "MD_CEO"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.SALES_OFFICER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")
    approvals = relationship(
    "ApprovalWorkflow",
    foreign_keys="ApprovalWorkflow.actor_id",
    back_populates="actor"
)
    uploads = relationship("UploadBatch", back_populates="uploaded_by_user")
