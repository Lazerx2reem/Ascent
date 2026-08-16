"""Pure training plan generation from detected weaknesses.

Deterministic and offline: the same weaknesses always produce the same plan, so
it can be unit-tested and it works without an API key. The AI coach reads the
same weaknesses through a tool, so the athlete can argue with the plan in chat —
but the plan itself is not model-generated.

Session blocks intentionally use the same {exercise, detail, sets} shape as
logged training sessions, so a planned session can be logged as-is.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .weaknesses import Weakness

MIN_WEEKS, MAX_WEEKS = 1, 12
MIN_DAYS, MAX_DAYS = 1, 6
DEFAULT_WEEKS, DEFAULT_DAYS = 4, 3

# Plans of four weeks or more end on a deload — the week the adaptation
# actually lands.
DELOAD_MIN_WEEKS = 4

# At most this many areas, or the plan stops being a plan and becomes a wish.
MAX_FOCUS_AREAS = 3

# A plan that ignores an overreaching signal is worse than no plan, so a high
# severity recovery finding caps the week.
RECOVERY_MAX_DAYS = 2


@dataclass(frozen=True)
class PlanBlock:
    exercise: str
    detail: str
    sets: int


@dataclass(frozen=True)
class PlannedSession:
    week: int
    day: int
    title: str
    # Matches the logbook's session_type vocabulary so it can be logged directly.
    session_type: str
    focus: str
    blocks: list[PlanBlock] = field(default_factory=list)
    notes: str = ""


@dataclass(frozen=True)
class TrainingPlanDraft:
    weeks: int
    days_per_week: int
    focus_areas: list[str] = field(default_factory=list)
    summary: str = ""
    cautions: list[str] = field(default_factory=list)
    sessions: list[PlannedSession] = field(default_factory=list)


@dataclass(frozen=True)
class FocusTemplate:
    label: str
    session_type: str
    # (exercise, detail, base sets)
    blocks: tuple[tuple[str, str, int], ...]
    notes: str = ""
    # Fingers and recovery progress by load or not at all, never by adding sets.
    progressive: bool = True
    caution: str = ""


FOCUS_LIBRARY: dict[str, FocusTemplate] = {
    "steep_terrain": FocusTemplate(
        label="Steep terrain",
        session_type="gym",
        blocks=(
            ("Steep bouldering", "Overhang problems 1-2 grades below max, hips into the wall", 4),
            ("Tension traverse", "Straight-arm traverse on 30-40°, feet quiet", 3),
        ),
        notes="Stop the session when your feet start cutting involuntarily — past that you're training sloppiness.",
    ),
    "slab_technique": FocusTemplate(
        label="Slab and vertical",
        session_type="gym",
        blocks=(
            ("Slab volume", "Low-angle problems, weight over the feet, no hands where possible", 5),
            ("Precision footwork", "Silent-feet ladder on vertical terrain", 3),
        ),
        notes="Slab rewards patience and balance, not pulling. Slow everything down.",
    ),
    "mileage": FocusTemplate(
        label="Base mileage",
        session_type="gym",
        blocks=(
            ("Volume circuit", "8-10 problems 2-3 grades below max, minimal rest", 3),
            ("Down-climb pyramid", "Up one grade at a time, down-climb every problem", 2),
        ),
        notes="Every problem should feel repeatable. If you're falling, it's too hard for this block.",
    ),
    "technique_hips": FocusTemplate(
        label="Hip position",
        session_type="gym",
        blocks=(
            ("Hip-turn drill", "Backstep or drop-knee on every move of an easy problem", 4),
            ("Straight-arm traverse", "Hips pressed to the wall, arms locked straight", 3),
        ),
        notes="The goal is turning a hip in before you reach, not after.",
    ),
    "movement_control": FocusTemplate(
        label="Movement control",
        session_type="gym",
        blocks=(
            ("Slow-motion climbing", "Five seconds per move on an easy problem", 4),
            ("Lock-off ladder", "Pause three seconds at each hold before matching", 3),
        ),
        notes="Initiate from the legs. If the move lurches, downgrade and repeat it.",
    ),
    "technique_feet": FocusTemplate(
        label="Footwork",
        session_type="gym",
        blocks=(
            ("Silent feet", "Easy problems with no audible foot placement", 5),
            ("One-touch footwork", "Place each foot once — no readjusting", 3),
        ),
        notes="Look at the foothold until your shoe is on it. Most sloppy feet are unwatched feet.",
    ),
    "core_tension": FocusTemplate(
        label="Body tension",
        session_type="board",
        blocks=(
            ("Board problems", "Steep problems chosen for tension over reach", 4),
            ("Front lever progression", "Tuck to advanced tuck, 5-8s holds", 4),
        ),
        notes="Tension is a skill before it's a strength — keep the feet on.",
    ),
    "route_reading": FocusTemplate(
        label="Reading and first-go execution",
        session_type="gym",
        blocks=(
            ("Onsight practice", "Read fully from the ground, then one attempt only", 6),
            ("Blind beta", "Have a partner pick problems you haven't watched", 2),
        ),
        notes="No rehearsing and no watching others first — the whole point is the first attempt.",
    ),
    "finger_strength": FocusTemplate(
        label="Finger strength",
        session_type="hangboard",
        blocks=(
            ("Max hangs", "20mm edge, 7-10s, full rest between hangs", 5),
            ("Repeaters", "20mm, 7s on / 3s off x 6", 3),
        ),
        notes="Warm up thoroughly first. Progress by adding load, never by adding sets.",
        progressive=False,
        caution=(
            "Stop a hangboard session immediately if you feel anything sharp in a "
            "finger or a pop — tendons recover far slower than muscle."
        ),
    ),
    "consistency": FocusTemplate(
        label="Consistency",
        session_type="gym",
        blocks=(
            ("Short quality session", "45 minutes, climb well, leave wanting more", 3),
        ),
        notes="The point is showing up. A short session beats a skipped one every time.",
    ),
    "recovery": FocusTemplate(
        label="Recovery",
        session_type="other",
        blocks=(
            ("Easy movement", "ARC traverse at conversational effort, 20 minutes", 2),
            ("Mobility", "Shoulders, hips, wrists", 2),
        ),
        notes="This is the session that makes the others work. Keep RPE at or below 5.",
        progressive=False,
        caution=(
            "Your logged load is already high. Treat this plan as a step down, and "
            "see a physio who treats climbers if anything hurts rather than aches."
        ),
    ),
}

# Used when nothing scores badly enough to be worth a dedicated block.
MAINTENANCE_FOCUS = "mileage"


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


def _sets_for(base: int, week: int, is_deload: bool, progressive: bool) -> int:
    if is_deload:
        return max(1, base - 1)
    if not progressive:
        return base
    # Ramp for three weeks, then hold — the deload week takes it back down.
    return base + min(week - 1, 2)


def _select_focus_areas(weaknesses: list[Weakness]) -> list[str]:
    """Focus tags worth a dedicated session, weakest first, de-duplicated."""
    ordered: list[str] = []
    for w in sorted(weaknesses, key=lambda w: w.score):
        if w.severity == "low":
            continue
        if w.focus in FOCUS_LIBRARY and w.focus not in ordered:
            ordered.append(w.focus)
    return ordered[:MAX_FOCUS_AREAS] or [MAINTENANCE_FOCUS]


def build_plan(
    weaknesses: list[Weakness],
    weeks: int = DEFAULT_WEEKS,
    days_per_week: int = DEFAULT_DAYS,
) -> TrainingPlanDraft:
    """Turn ranked weaknesses into a periodized block.

    Inputs are clamped rather than validated — this is called with user-supplied
    numbers from the API, and a nonsense value should produce a sane plan.
    """
    weeks = _clamp(weeks, MIN_WEEKS, MAX_WEEKS)
    days_per_week = _clamp(days_per_week, MIN_DAYS, MAX_DAYS)

    focus_areas = _select_focus_areas(weaknesses)
    cautions = []

    # An overreaching signal overrides whatever else the plan wanted to do.
    overreaching = next(
        (w for w in weaknesses if w.focus == "recovery" and w.severity == "high"), None
    )
    if overreaching is not None:
        days_per_week = min(days_per_week, RECOVERY_MAX_DAYS)
        if "recovery" in focus_areas:
            focus_areas.remove("recovery")
        focus_areas.insert(0, "recovery")
        focus_areas = focus_areas[:MAX_FOCUS_AREAS]

    for focus in focus_areas:
        caution = FOCUS_LIBRARY[focus].caution
        if caution:
            cautions.append(caution)

    sessions: list[PlannedSession] = []
    for week in range(1, weeks + 1):
        is_deload = weeks >= DELOAD_MIN_WEEKS and week == weeks
        for day in range(1, days_per_week + 1):
            # Round-robin so each focus gets even attention across the week.
            focus = focus_areas[(day - 1) % len(focus_areas)]
            template = FOCUS_LIBRARY[focus]
            blocks = [
                PlanBlock(
                    exercise=exercise,
                    detail=detail,
                    sets=_sets_for(base, week, is_deload, template.progressive),
                )
                for exercise, detail, base in template.blocks
            ]
            notes = template.notes
            if is_deload:
                notes = f"Deload week — cut the intensity, keep the movement. {notes}"
            sessions.append(
                PlannedSession(
                    week=week,
                    day=day,
                    title=template.label,
                    session_type=template.session_type,
                    focus=focus,
                    blocks=blocks,
                    notes=notes,
                )
            )

    labels = [FOCUS_LIBRARY[f].label.lower() for f in focus_areas]
    joined = labels[0] if len(labels) == 1 else (
        f"{', '.join(labels[:-1])} and {labels[-1]}"
    )
    summary = (
        f"A {weeks}-week block, {days_per_week} sessions a week, built around "
        f"{joined}."
    )
    if weeks >= DELOAD_MIN_WEEKS:
        summary += f" Week {weeks} is a deload."
    if overreaching is not None:
        summary = (
            "Your recent load looks high, so this block steps down before it "
            "builds. " + summary
        )

    return TrainingPlanDraft(
        weeks=weeks,
        days_per_week=days_per_week,
        focus_areas=[FOCUS_LIBRARY[f].label for f in focus_areas],
        summary=summary,
        cautions=cautions,
        sessions=sessions,
    )
