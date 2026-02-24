"""Project activity log endpoints and write helper."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import ProjectLog
from src.schemas import ProjectLogResponse

router = APIRouter(prefix="/projects", tags=["logs"])


# ---------------------------------------------------------------------------
# Helper — called by other modules to record events
# ---------------------------------------------------------------------------


def write_log(
    db: Session,
    project_id: int,
    level: str,       # "INFO" | "WARNING" | "ERROR"
    event_type: str,  # e.g. DOCUMENT_UPLOADED, EXTRACTION_COMPLETED
    message: str,
) -> None:
    """Append an activity log entry for the project.

    Swallows all exceptions so logging never breaks the calling operation.
    """
    try:
        log = ProjectLog(
            project_id=project_id,
            level=level,
            event_type=event_type,
            message=message,
        )
        db.add(log)
        db.commit()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/{project_id}/logs", response_model=list[ProjectLogResponse])
def get_logs(
    project_id: int,
    limit: int = Query(default=300, ge=1, le=1000),
    level: str | None = Query(default=None, description="Filter by level: INFO | WARNING | ERROR"),
    db: Session = Depends(get_db),
):
    """Return recent activity logs for a project, newest first."""
    q = db.query(ProjectLog).filter(ProjectLog.project_id == project_id)
    if level:
        q = q.filter(ProjectLog.level == level.upper())
    return q.order_by(ProjectLog.created_at.desc()).limit(limit).all()


@router.delete("/{project_id}/logs", status_code=204)
def clear_logs(
    project_id: int,
    db: Session = Depends(get_db),
):
    """Delete all activity logs for a project."""
    db.query(ProjectLog).filter(ProjectLog.project_id == project_id).delete()
    db.commit()
    return None
