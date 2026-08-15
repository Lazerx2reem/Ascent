"""A flat, read-only view of one athlete's training history.

The weakness engine and plan generator work off these records rather than ORM
rows, so both stay pure functions of plain data and can be tested by building a
snapshot literal — no database, no fixtures. This module is the only place in
the training package that touches SQLAlchemy.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..grades import SEND_TYPES, grade_sort_key
from ..models import Climb, PoseAnalysis, TrainingSession, User

# Exercise names that count as dedicated finger/max-strength work, matched as
# substrings against logged exercise names.
STRENGTH_EXERCISES = ("hangboard", "fingerboard", "campus", "weighted", "max hang")


@dataclass(frozen=True)
class ClimbRecord:
    grade: str
    # Difficulty index within its own scale; -1 for grades we don't recognise.
    grade_value: int
    climb_type: str
    wall_angle: str | None
    send_type: str
    attempt_count: int
    climbed_on: date

    @property
    def is_send(self) -> bool:
        return self.send_type in SEND_TYPES

    @property
    def is_boulder(self) -> bool:
        return self.climb_type == "boulder"


@dataclass(frozen=True)
class SessionRecord:
    session_date: date
    session_type: str
    duration_minutes: int
    rpe: int | None
    exercises: tuple[str, ...] = ()

    @property
    def is_strength_work(self) -> bool:
        """Dedicated finger or max-strength work, by session type or exercise."""
        if self.session_type == "hangboard":
            return True
        return any(
            token in exercise.lower()
            for exercise in self.exercises
            for token in STRENGTH_EXERCISES
        )


@dataclass(frozen=True)
class AnalysisRecord:
    analyzed_on: date
    overall_score: int
    # metric key -> 0-100 score, e.g. {"hip_position": 62, ...}
    metric_scores: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class TrainingSnapshot:
    today: date
    climbs: list[ClimbRecord] = field(default_factory=list)
    sessions: list[SessionRecord] = field(default_factory=list)
    analyses: list[AnalysisRecord] = field(default_factory=list)
    climbing_style: str | None = None

    def climbs_since(self, days: int) -> list[ClimbRecord]:
        cutoff = self.today - _days(days)
        return [c for c in self.climbs if c.climbed_on >= cutoff]

    def climbs_between(self, start_days_ago: int, end_days_ago: int) -> list[ClimbRecord]:
        """Climbs in the window [start_days_ago, end_days_ago) days back."""
        newest = self.today - _days(end_days_ago)
        oldest = self.today - _days(start_days_ago)
        return [c for c in self.climbs if oldest <= c.climbed_on < newest]

    def sessions_since(self, days: int) -> list[SessionRecord]:
        cutoff = self.today - _days(days)
        return [s for s in self.sessions if s.session_date >= cutoff]

    def analyses_since(self, days: int) -> list[AnalysisRecord]:
        cutoff = self.today - _days(days)
        return [a for a in self.analyses if a.analyzed_on >= cutoff]


def _days(n: int):
    from datetime import timedelta

    return timedelta(days=n)


def _exercise_names(workout_details) -> tuple[str, ...]:
    if not workout_details:
        return ()
    names = []
    for item in workout_details:
        if isinstance(item, dict):
            # The detail often carries the specific ("20mm 7/3 repeaters"), so
            # keep both — strength matching reads either.
            names.append(f"{item.get('exercise', '')} {item.get('detail', '')}".strip())
    return tuple(n for n in names if n)


def build_snapshot(user: User, db: Session, today: date | None = None) -> TrainingSnapshot:
    """Assemble everything the training engines need in three queries."""
    climbs = db.scalars(select(Climb).where(Climb.user_id == user.id))
    sessions = db.scalars(
        select(TrainingSession).where(TrainingSession.user_id == user.id)
    )
    analyses = db.scalars(
        select(PoseAnalysis).where(PoseAnalysis.user_id == user.id)
    )

    return TrainingSnapshot(
        today=today or date.today(),
        climbs=[
            ClimbRecord(
                grade=c.grade,
                grade_value=grade_sort_key(c.grade),
                climb_type=c.climb_type,
                wall_angle=c.wall_angle,
                send_type=c.send_type,
                attempt_count=c.attempt_count,
                climbed_on=c.climbed_on,
            )
            for c in climbs
        ],
        sessions=[
            SessionRecord(
                session_date=s.session_date,
                session_type=s.session_type,
                duration_minutes=s.duration_minutes,
                rpe=s.rpe,
                exercises=_exercise_names(s.workout_details),
            )
            for s in sessions
        ],
        analyses=[
            AnalysisRecord(
                analyzed_on=a.created_at.date(),
                overall_score=a.overall_score,
                metric_scores={
                    key: int(metric.get("score", 0))
                    for key, metric in (a.metrics or {}).items()
                },
            )
            for a in analyses
        ],
        climbing_style=user.climbing_style,
    )
