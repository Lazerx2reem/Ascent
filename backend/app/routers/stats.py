from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..grades import SEND_TYPES, grade_sort_key
from ..models import Climb, TrainingSession, User
from ..schemas import AngleEntry, ProgressPoint, PyramidEntry, StatsSummary

router = APIRouter(prefix="/stats", tags=["stats"])


def _user_climbs(user: User, db: Session) -> list[Climb]:
    return list(db.scalars(select(Climb).where(Climb.user_id == user.id)))


def _is_send(climb: Climb) -> bool:
    return climb.send_type in SEND_TYPES


@router.get("/pyramid", response_model=list[PyramidEntry])
def grade_pyramid(
    discipline: str = Query(default="boulder", pattern="^(boulder|route)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PyramidEntry]:
    """Send counts per grade, hardest first — the classic pyramid."""
    climbs = _user_climbs(user, db)
    if discipline == "boulder":
        sends = [c for c in climbs if _is_send(c) and c.climb_type == "boulder"]
    else:
        sends = [c for c in climbs if _is_send(c) and c.climb_type in ("sport", "trad")]
    counts = Counter(c.grade for c in sends)
    ordered = sorted(counts, key=grade_sort_key, reverse=True)
    return [PyramidEntry(grade=g, count=counts[g]) for g in ordered]


@router.get("/progress", response_model=list[ProgressPoint])
def sends_over_time(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProgressPoint]:
    """Sends per calendar month, with empty months filled in."""
    sends = [c for c in _user_climbs(user, db) if _is_send(c)]
    if not sends:
        return []
    by_month = Counter(c.climbed_on.strftime("%Y-%m") for c in sends)
    first = min(c.climbed_on for c in sends)
    today = date.today()
    points: list[ProgressPoint] = []
    year, month = first.year, first.month
    while (year, month) <= (today.year, today.month):
        key = f"{year:04d}-{month:02d}"
        points.append(ProgressPoint(month=key, sends=by_month.get(key, 0)))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return points


@router.get("/angles", response_model=list[AngleEntry])
def volume_by_angle(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AngleEntry]:
    """How much the user climbs on each wall angle (all logged climbs)."""
    climbs = [c for c in _user_climbs(user, db) if c.wall_angle]
    counts = Counter(c.wall_angle for c in climbs)
    order = ["slab", "vertical", "overhang", "roof"]
    return [AngleEntry(wall_angle=a, count=counts[a]) for a in order if a in counts]


@router.get("/summary", response_model=StatsSummary)
def summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StatsSummary:
    climbs = _user_climbs(user, db)
    sends = [c for c in climbs if _is_send(c)]
    sessions = list(
        db.scalars(select(TrainingSession).where(TrainingSession.user_id == user.id))
    )
    boulder_sends = [c.grade for c in sends if c.climb_type == "boulder"]
    route_sends = [c.grade for c in sends if c.climb_type in ("sport", "trad")]
    return StatsSummary(
        total_climbs=len(climbs),
        total_sends=len(sends),
        total_sessions=len(sessions),
        total_hours=round(sum(s.duration_minutes for s in sessions) / 60, 1),
        hardest_boulder=max(boulder_sends, key=grade_sort_key, default=None),
        hardest_route=max(route_sends, key=grade_sort_key, default=None),
    )
