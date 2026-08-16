from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import TrainingPlan, User
from ..schemas import (
    TrainingPlanCreate,
    TrainingPlanDetailOut,
    TrainingPlanOut,
    WeaknessReportOut,
)
from ..training.plan import build_plan
from ..training.snapshot import build_snapshot
from ..training.weaknesses import detect_weaknesses

router = APIRouter(prefix="/training", tags=["training"])

TITLE_LENGTH = 120


def _get_owned_plan(plan_id: int, user: User, db: Session) -> TrainingPlan:
    plan = db.get(TrainingPlan, plan_id)
    if plan is None or plan.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Training plan not found"
        )
    return plan


def _default_title(weeks: int, focus_areas: list[str]) -> str:
    focus = ", ".join(area.lower() for area in focus_areas)
    return f"{weeks}-week block — {focus}"[:TITLE_LENGTH]


@router.get("/weaknesses", response_model=WeaknessReportOut)
def weaknesses(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeaknessReportOut:
    """Score every assessable area of the athlete's climbing, weakest first."""
    report = detect_weaknesses(build_snapshot(user, db))
    return WeaknessReportOut.model_validate(report)


@router.get("/plans", response_model=list[TrainingPlanOut])
def list_plans(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TrainingPlan]:
    query = (
        select(TrainingPlan)
        .where(TrainingPlan.user_id == user.id)
        .order_by(TrainingPlan.created_at.desc(), TrainingPlan.id.desc())
    )
    return list(db.scalars(query))


@router.post(
    "/plans", response_model=TrainingPlanDetailOut, status_code=status.HTTP_201_CREATED
)
def create_plan(
    payload: TrainingPlanCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrainingPlan:
    """Generate a plan from the athlete's current weaknesses and store it.

    The weaknesses are frozen into the row alongside the plan: regenerating the
    reasoning later, from a logbook that has since moved on, would quietly
    change what the plan was for.
    """
    report = detect_weaknesses(build_snapshot(user, db))
    draft = build_plan(
        report.weaknesses, weeks=payload.weeks, days_per_week=payload.days_per_week
    )

    plan = TrainingPlan(
        user_id=user.id,
        title=payload.title or _default_title(draft.weeks, draft.focus_areas),
        weeks=draft.weeks,
        days_per_week=draft.days_per_week,
        summary=draft.summary,
        focus_areas=draft.focus_areas,
        cautions=draft.cautions,
        sessions=[asdict(s) for s in draft.sessions],
        weaknesses=[asdict(w) for w in report.weaknesses],
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/plans/{plan_id}", response_model=TrainingPlanDetailOut)
def get_plan(
    plan_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrainingPlan:
    return _get_owned_plan(plan_id, user, db)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(
    plan_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    plan = _get_owned_plan(plan_id, user, db)
    db.delete(plan)
    db.commit()
