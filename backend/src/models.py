import enum
import json
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ProjectStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    ERROR = "ERROR"


class ParseStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PARSING = "PARSING"
    DONE = "DONE"
    ERROR = "ERROR"


class ReviewStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    MANUAL_UPDATED = "MANUAL_UPDATED"
    MISSING_DATA = "MISSING_DATA"
    STALE = "STALE"


class LogLevel(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.PENDING, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    template = relationship("FieldTemplate", back_populates="project", uselist=False, cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    format = Column(String(20), nullable=False)  # pdf, docx, html, txt
    parse_status = Column(Enum(ParseStatus), default=ParseStatus.QUEUED, nullable=False)
    parsed_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="documents")
    extraction_records = relationship(
        "ExtractionRecord", back_populates="document", cascade="all, delete-orphan"
    )


class FieldTemplate(Base):
    __tablename__ = "field_templates"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True)
    # JSON list of field definitions:
    # [{ "key": str, "type": str, "description": str, "required": bool }]
    fields_json = Column(Text, nullable=False, default="[]")
    version = Column(Integer, default=1, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    project = relationship("Project", back_populates="template")

    @property
    def fields(self) -> list:
        return json.loads(self.fields_json)

    @fields.setter
    def fields(self, value: list) -> None:
        self.fields_json = json.dumps(value)


class ExtractionRecord(Base):
    __tablename__ = "extraction_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    field_key = Column(String(255), nullable=False)

    # AI extraction output
    value = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    # JSON list: [{ "page": int|str, "excerpt": str }]
    citations_json = Column(Text, nullable=True, default="[]")
    confidence = Column(Float, nullable=True)
    normalized_value = Column(Text, nullable=True)

    # Review
    review_status = Column(
        Enum(ReviewStatus), default=ReviewStatus.PENDING, nullable=False
    )
    manual_value = Column(Text, nullable=True)  # stored alongside AI result, never overwrites

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    document = relationship("Document", back_populates="extraction_records")

    @property
    def citations(self) -> list:
        return json.loads(self.citations_json or "[]")

    @citations.setter
    def citations(self, value: list) -> None:
        self.citations_json = json.dumps(value)


class EvaluationLabel(Base):
    """Human-labeled ground truth for evaluating extraction quality."""

    __tablename__ = "evaluation_labels"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    document_filename = Column(String(500), nullable=False)
    field_key = Column(String(255), nullable=False)
    expected_value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ProjectLog(Base):
    """Activity log for tracking file uploads, removals, extraction events, etc."""

    __tablename__ = "project_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    level = Column(Enum(LogLevel), default=LogLevel.INFO, nullable=False)
    event_type = Column(String(64), nullable=False)  # e.g. DOCUMENT_UPLOADED
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
