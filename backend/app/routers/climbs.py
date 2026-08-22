import os
from datetime import date

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..database import get_db
from ..models import Attempt, Climb, User
from ..schemas import AttemptCreate, AttemptOut, ClimbCreate, ClimbOut, ClimbUpdate
from ..storage import new_storage_key, storage

router = APIRouter(prefix="/climbs", tags=["climbs"])


def _get_owned_climb(climb_id: int, user: User, db: Session) -> Climb:
    climb = db.get(Climb, climb_id)
    if climb is None or climb.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Climb not found")
    return climb


@router.get("", response_model=list[ClimbOut])
def list_climbs(
    climb_type: str | None = Query(default=None, pattern="^(boulder|sport|trad)$"),
    send_type: str | None = Query(
        default=None, pattern="^(flash|onsight|redpoint|repeat|project)$"
    ),
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Climb]:
    query = select(Climb).where(Climb.user_id == user.id)
    if climb_type is not None:
        query = query.where(Climb.climb_type == climb_type)
    if send_type is not None:
        query = query.where(Climb.send_type == send_type)
    if date_from is not None:
        query = query.where(Climb.climbed_on >= date_from)
    if date_to is not None:
        query = query.where(Climb.climbed_on <= date_to)
    query = query.order_by(Climb.climbed_on.desc(), Climb.id.desc())
    return list(db.scalars(query))


@router.post("", response_model=ClimbOut, status_code=status.HTTP_201_CREATED)
def create_climb(
    payload: ClimbCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Climb:
    climb = Climb(user_id=user.id, **payload.model_dump())
    db.add(climb)
    db.commit()
    db.refresh(climb)
    return climb


@router.get("/{climb_id}", response_model=ClimbOut)
def get_climb(
    climb_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Climb:
    return _get_owned_climb(climb_id, user, db)


@router.patch("/{climb_id}", response_model=ClimbOut)
def update_climb(
    climb_id: int,
    payload: ClimbUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Climb:
    climb = _get_owned_climb(climb_id, user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(climb, field, value)
    db.commit()
    db.refresh(climb)
    return climb


@router.delete("/{climb_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_climb(
    climb_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    climb = _get_owned_climb(climb_id, user, db)
    # Drop the photo too — nothing else references it, so leaving it behind
    # would orphan bytes in storage that no row can ever reach.
    if climb.image_key:
        storage.delete(climb.image_key)
    db.delete(climb)
    db.commit()


# ---------- Climb photo ----------


@router.put("/{climb_id}/image", response_model=ClimbOut)
def upload_climb_image(
    climb_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Climb:
    """Attach (or replace) the climb's photo.

    PUT rather than POST: a climb has at most one photo, so uploading twice
    should replace rather than accumulate.
    """
    if file.content_type not in settings.allowed_image_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported type {file.content_type!r}. "
            f"Allowed: {', '.join(settings.allowed_image_types)}",
        )
    climb = _get_owned_climb(climb_id, user, db)

    key = new_storage_key(file.filename or "climb.jpg", prefix="climbs")
    size = storage.save(key, file.file)

    max_bytes = settings.max_image_mb * 1024 * 1024
    if size > max_bytes:
        storage.delete(key)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds {settings.max_image_mb} MB limit.",
        )

    previous = climb.image_key
    climb.image_key = key
    climb.image_content_type = file.content_type
    climb.image_size_bytes = size
    db.commit()
    db.refresh(climb)
    # Only after the row points at the new key, so a failed commit can't leave
    # the climb referencing bytes that are already gone.
    if previous:
        storage.delete(previous)
    return climb


@router.get("/{climb_id}/image")
def get_climb_image(
    climb_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    climb = _get_owned_climb(climb_id, user, db)
    if not climb.image_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="This climb has no photo."
        )
    get_path = getattr(storage, "path", None)
    if get_path is None:
        raise HTTPException(status_code=501, detail="Not supported for this backend")
    path = get_path(climb.image_key)
    if not os.path.exists(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo file is missing."
        )
    return FileResponse(path, media_type=climb.image_content_type or "image/jpeg")


@router.delete("/{climb_id}/image", response_model=ClimbOut)
def delete_climb_image(
    climb_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Climb:
    climb = _get_owned_climb(climb_id, user, db)
    if climb.image_key:
        storage.delete(climb.image_key)
    climb.image_key = None
    climb.image_content_type = None
    climb.image_size_bytes = None
    db.commit()
    db.refresh(climb)
    return climb


# ---------- Attempts on a climb ----------


@router.get("/{climb_id}/attempts", response_model=list[AttemptOut])
def list_attempts(
    climb_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Attempt]:
    climb = _get_owned_climb(climb_id, user, db)
    return sorted(climb.attempts, key=lambda a: (a.attempt_date, a.id))


@router.post(
    "/{climb_id}/attempts", response_model=AttemptOut, status_code=status.HTTP_201_CREATED
)
def create_attempt(
    climb_id: int,
    payload: AttemptCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Attempt:
    climb = _get_owned_climb(climb_id, user, db)
    attempt = Attempt(climb_id=climb.id, user_id=user.id, **payload.model_dump())
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt
