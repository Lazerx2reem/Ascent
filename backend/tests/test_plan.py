"""Unit tests for the pure training plan generator."""
import pytest

from app.training.plan import (
    DELOAD_MIN_WEEKS,
    FOCUS_LIBRARY,
    MAX_FOCUS_AREAS,
    RECOVERY_MAX_DAYS,
    build_plan,
)
from app.training.weaknesses import Weakness


def _weakness(focus: str, score: int, key: str | None = None) -> Weakness:
    severity = "high" if score < 40 else "moderate" if score < 65 else "low"
    return Weakness(
        key=key or focus,
        label=focus.replace("_", " ").title(),
        focus=focus,
        score=score,
        severity=severity,
        summary="",
        evidence=["evidence"],
        advice="advice",
    )


def test_plan_targets_the_weakest_areas():
    plan = build_plan(
        [
            _weakness("technique_feet", 30),
            _weakness("steep_terrain", 45),
            _weakness("mileage", 90),  # healthy, shouldn't earn a session
        ]
    )
    assert plan.focus_areas == [
        FOCUS_LIBRARY["technique_feet"].label,
        FOCUS_LIBRARY["steep_terrain"].label,
    ]
    assert {s.focus for s in plan.sessions} == {"technique_feet", "steep_terrain"}


def test_focus_areas_are_capped():
    plan = build_plan([_weakness(f, 20) for f in FOCUS_LIBRARY])
    assert len(plan.focus_areas) == MAX_FOCUS_AREAS


def test_a_clean_logbook_still_produces_a_maintenance_plan():
    plan = build_plan([_weakness("technique_feet", 95)])
    assert plan.sessions
    assert plan.focus_areas == [FOCUS_LIBRARY["mileage"].label]


def test_no_weaknesses_at_all_still_produces_a_plan():
    plan = build_plan([])
    assert plan.weeks > 0 and plan.sessions


def test_session_count_matches_weeks_and_days():
    plan = build_plan([_weakness("mileage", 30)], weeks=6, days_per_week=4)
    assert len(plan.sessions) == 24
    assert [s.week for s in plan.sessions[:4]] == [1, 1, 1, 1]
    assert plan.sessions[-1].week == 6


def test_sets_ramp_then_deload():
    plan = build_plan([_weakness("mileage", 30)], weeks=4, days_per_week=1)
    by_week = {s.week: s.blocks[0].sets for s in plan.sessions}
    assert by_week[1] < by_week[2] < by_week[3]
    # Week four is the deload — below where the block started.
    assert by_week[4] < by_week[1]
    assert "Deload" in plan.sessions[-1].notes
    assert "Week 4 is a deload" in plan.summary


def test_short_plans_have_no_deload():
    plan = build_plan([_weakness("mileage", 30)], weeks=DELOAD_MIN_WEEKS - 1)
    assert all("Deload" not in s.notes for s in plan.sessions)
    assert "deload" not in plan.summary


def test_finger_work_progresses_by_load_not_by_volume():
    plan = build_plan([_weakness("finger_strength", 20)], weeks=3, days_per_week=1)
    sets = {s.blocks[0].sets for s in plan.sessions}
    assert len(sets) == 1  # sets never ramp for hangboarding
    assert any("adding load" in s.notes for s in plan.sessions)


def test_finger_work_carries_a_caution():
    plan = build_plan([_weakness("finger_strength", 20)])
    assert any("sharp" in caution for caution in plan.cautions)


def test_high_recovery_load_caps_the_week_and_leads_the_plan():
    plan = build_plan(
        [
            _weakness("recovery", 20),
            _weakness("finger_strength", 25),
            _weakness("steep_terrain", 30),
        ],
        days_per_week=5,
    )
    assert plan.days_per_week == RECOVERY_MAX_DAYS
    assert plan.focus_areas[0] == FOCUS_LIBRARY["recovery"].label
    assert plan.summary.startswith("Your recent load looks high")
    assert any("step down" in caution for caution in plan.cautions)


def test_moderate_recovery_finding_does_not_cap_the_week():
    plan = build_plan([_weakness("recovery", 55), _weakness("mileage", 30)], days_per_week=4)
    assert plan.days_per_week == 4


@pytest.mark.parametrize(
    "weeks,days,expected_weeks,expected_days",
    [(0, 0, 1, 1), (99, 99, 12, 6), (-3, -3, 1, 1)],
)
def test_nonsense_inputs_are_clamped(weeks, days, expected_weeks, expected_days):
    plan = build_plan([_weakness("mileage", 30)], weeks=weeks, days_per_week=days)
    assert plan.weeks == expected_weeks
    assert plan.days_per_week == expected_days


def test_blocks_match_the_logbook_workout_shape():
    """A planned session should be loggable as a training session as-is."""
    from app.schemas import WorkoutItem

    plan = build_plan([_weakness("steep_terrain", 30)])
    for session in plan.sessions:
        for block in session.blocks:
            item = WorkoutItem(
                exercise=block.exercise, detail=block.detail, sets=block.sets
            )
            assert item.sets >= 1


def test_session_types_are_valid_logbook_types():
    valid = {"gym", "board", "outdoor", "hangboard", "other"}
    for template in FOCUS_LIBRARY.values():
        assert template.session_type in valid


def test_every_focus_template_is_usable():
    for focus, template in FOCUS_LIBRARY.items():
        plan = build_plan([_weakness(focus, 20)], weeks=1, days_per_week=1)
        assert plan.sessions[0].focus == focus
        assert plan.sessions[0].blocks
        assert template.label in plan.summary or template.label in plan.focus_areas
