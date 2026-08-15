"""Unit tests for the pure weakness engine.

Snapshots are built as literals, so none of this needs a database — the same
split the phase 2 metrics engine uses.
"""
from datetime import date, timedelta

from app.grades import grade_sort_key
from app.training.snapshot import (
    AnalysisRecord,
    ClimbRecord,
    SessionRecord,
    TrainingSnapshot,
)
from app.training.weaknesses import detect_weaknesses

TODAY = date(2026, 8, 17)


def _climb(
    days_ago: int = 5,
    grade: str = "V4",
    climb_type: str = "boulder",
    wall_angle: str | None = "vertical",
    send_type: str = "redpoint",
    attempts: int = 2,
) -> ClimbRecord:
    return ClimbRecord(
        grade=grade,
        grade_value=grade_sort_key(grade),
        climb_type=climb_type,
        wall_angle=wall_angle,
        send_type=send_type,
        attempt_count=attempts,
        climbed_on=TODAY - timedelta(days=days_ago),
    )


def _session(
    days_ago: int = 3,
    session_type: str = "gym",
    minutes: int = 90,
    rpe: int | None = 6,
    exercises: tuple[str, ...] = (),
) -> SessionRecord:
    return SessionRecord(
        session_date=TODAY - timedelta(days=days_ago),
        session_type=session_type,
        duration_minutes=minutes,
        rpe=rpe,
        exercises=exercises,
    )


def _snapshot(**kwargs) -> TrainingSnapshot:
    return TrainingSnapshot(today=TODAY, **kwargs)


def _find(report, key):
    return next((w for w in report.weaknesses if w.key == key), None)


# ---------- Angle coverage ----------


def test_avoiding_steep_ground_is_flagged():
    report = detect_weaknesses(
        _snapshot(climbs=[_climb(days_ago=i, wall_angle="vertical") for i in range(1, 15)])
    )
    finding = _find(report, "angle_coverage")
    assert finding is not None
    assert finding.severity == "high"
    assert finding.focus == "steep_terrain"
    assert "0%" in finding.summary


def test_avoiding_low_angle_ground_is_flagged_the_other_way():
    report = detect_weaknesses(
        _snapshot(climbs=[_climb(days_ago=i, wall_angle="overhang") for i in range(1, 15)])
    )
    finding = _find(report, "angle_coverage")
    assert finding.focus == "slab_technique"


def test_balanced_angles_score_well():
    angles = ["slab", "vertical", "overhang", "roof"]
    report = detect_weaknesses(
        _snapshot(
            climbs=[
                _climb(days_ago=i, wall_angle=angles[i % 4]) for i in range(1, 17)
            ]
        )
    )
    finding = _find(report, "angle_coverage")
    assert finding.severity == "low"
    assert finding.score >= 65


def test_angle_coverage_stays_quiet_without_enough_logged_angles():
    report = detect_weaknesses(_snapshot(climbs=[_climb(days_ago=1, wall_angle=None)] * 20))
    assert _find(report, "angle_coverage") is None
    assert any("wall angle" in gap for gap in report.data_gaps)


# ---------- Pyramid ----------


def test_top_heavy_pyramid_is_flagged():
    # Four at the top grade, one below it — inverted.
    climbs = [_climb(grade="V6", send_type="redpoint") for _ in range(4)]
    climbs += [_climb(grade="V5", send_type="redpoint")]
    climbs += [_climb(grade="V4", send_type="flash") for _ in range(3)]
    report = detect_weaknesses(_snapshot(climbs=climbs))

    finding = _find(report, "pyramid_base")
    assert finding.severity == "high"
    assert finding.focus == "mileage"
    assert "V6" in finding.summary


def test_healthy_pyramid_scores_well():
    climbs = [_climb(grade="V6") for _ in range(1)]
    climbs += [_climb(grade="V5") for _ in range(4)]
    climbs += [_climb(grade="V4") for _ in range(8)]
    report = detect_weaknesses(_snapshot(climbs=climbs))
    assert _find(report, "pyramid_base").severity == "low"


def test_projects_do_not_count_toward_the_pyramid():
    climbs = [_climb(grade="V8", send_type="project") for _ in range(5)]
    climbs += [_climb(grade="V4", send_type="flash") for _ in range(6)]
    report = detect_weaknesses(_snapshot(climbs=climbs))
    # The unsent V8s must not become the top of the pyramid.
    assert "V4" in _find(report, "pyramid_base").summary


# ---------- Movement quality ----------


def test_movement_quality_reports_the_weakest_metric():
    report = detect_weaknesses(
        _snapshot(
            analyses=[
                AnalysisRecord(
                    analyzed_on=TODAY - timedelta(days=10),
                    overall_score=70,
                    metric_scores={
                        "hip_position": 80,
                        "cog_stability": 75,
                        "foot_control": 34,
                        "body_tension": 71,
                    },
                )
            ]
        )
    )
    finding = _find(report, "movement_quality")
    assert finding.focus == "technique_feet"
    assert finding.score == 34
    assert finding.severity == "high"


def test_movement_quality_averages_across_videos():
    def analysis(days_ago, feet):
        return AnalysisRecord(
            analyzed_on=TODAY - timedelta(days=days_ago),
            overall_score=70,
            metric_scores={"foot_control": feet, "hip_position": 90},
        )

    report = detect_weaknesses(_snapshot(analyses=[analysis(5, 40), analysis(20, 60)]))
    assert _find(report, "movement_quality").score == 50


# ---------- Rates, strength, consistency ----------


def test_low_flash_rate_is_flagged_as_reading():
    report = detect_weaknesses(
        _snapshot(climbs=[_climb(send_type="redpoint") for _ in range(12)])
    )
    finding = _find(report, "first_try_rate")
    assert finding.focus == "route_reading"
    assert finding.severity == "high"


def test_strong_flash_rate_scores_well():
    climbs = [_climb(send_type="flash") for _ in range(5)]
    climbs += [_climb(send_type="redpoint") for _ in range(7)]
    report = detect_weaknesses(_snapshot(climbs=climbs))
    assert _find(report, "first_try_rate").severity == "low"


def test_hangboarding_is_not_suggested_to_a_newer_climber():
    # Low grades and low volume: the right advice is more climbing, not fingers.
    report = detect_weaknesses(
        _snapshot(
            climbs=[_climb(grade="V1", send_type="flash") for _ in range(8)],
            sessions=[_session(days_ago=i * 3) for i in range(1, 12)],
        )
    )
    assert _find(report, "finger_strength") is None


def test_missing_strength_work_is_flagged_once_there_is_a_base():
    report = detect_weaknesses(
        _snapshot(
            climbs=[_climb(grade="V6", send_type="redpoint") for _ in range(8)],
            sessions=[_session(days_ago=i * 3, session_type="gym") for i in range(1, 12)],
        )
    )
    finding = _find(report, "finger_strength")
    assert finding is not None
    assert finding.severity == "high"


def test_hangboard_sessions_are_recognised_by_type_and_by_exercise():
    sessions = [_session(days_ago=i * 3, session_type="hangboard") for i in range(1, 7)]
    sessions += [
        _session(days_ago=i * 3 + 1, exercises=("campus board ladders",))
        for i in range(1, 7)
    ]
    report = detect_weaknesses(
        _snapshot(
            climbs=[_climb(grade="V6") for _ in range(8)],
            sessions=sessions,
        )
    )
    assert _find(report, "finger_strength").severity == "low"


def test_patchy_consistency_is_flagged():
    # Six sessions crammed into a single week of an eight-week window.
    report = detect_weaknesses(
        _snapshot(sessions=[_session(days_ago=1 + i) for i in range(6)])
    )
    finding = _find(report, "consistency")
    assert finding.severity == "high"
    assert "1 of the last 8 weeks" in finding.summary


def test_steady_weekly_training_scores_well():
    report = detect_weaknesses(
        _snapshot(sessions=[_session(days_ago=i * 7 + 1) for i in range(8)])
    )
    assert _find(report, "consistency").severity == "low"


# ---------- Load ----------


def test_sustained_high_rpe_is_flagged_as_a_recovery_problem():
    report = detect_weaknesses(
        _snapshot(sessions=[_session(days_ago=i * 2, rpe=9) for i in range(1, 10)])
    )
    finding = _find(report, "recovery_load")
    assert finding.severity == "high"
    assert finding.focus == "recovery"


def test_moderate_load_scores_well():
    report = detect_weaknesses(
        _snapshot(sessions=[_session(days_ago=i * 3, rpe=6) for i in range(1, 9)])
    )
    assert _find(report, "recovery_load").severity == "low"


def test_load_needs_logged_rpe():
    report = detect_weaknesses(
        _snapshot(sessions=[_session(days_ago=i * 3, rpe=None) for i in range(1, 9)])
    )
    assert _find(report, "recovery_load") is None
    assert any("RPE" in gap for gap in report.data_gaps)


# ---------- Trend and report shape ----------


def test_falling_volume_is_flagged():
    climbs = [_climb(days_ago=40 + i, send_type="flash") for i in range(10)]
    climbs += [_climb(days_ago=5, send_type="flash")]
    report = detect_weaknesses(_snapshot(climbs=climbs))
    finding = _find(report, "volume_trend")
    assert finding.severity == "high"
    assert "1 sends in the last 30 days" in finding.summary


def test_holding_volume_scores_well():
    climbs = [_climb(days_ago=40 + i, send_type="flash") for i in range(6)]
    climbs += [_climb(days_ago=1 + i, send_type="flash") for i in range(6)]
    report = detect_weaknesses(_snapshot(climbs=climbs))
    assert _find(report, "volume_trend").severity == "low"


def test_weaknesses_come_back_weakest_first():
    report = detect_weaknesses(
        _snapshot(
            climbs=[_climb(days_ago=i, wall_angle="vertical") for i in range(1, 15)],
            sessions=[_session(days_ago=i * 2, rpe=9) for i in range(1, 10)],
        )
    )
    scores = [w.score for w in report.weaknesses]
    assert scores == sorted(scores)


def test_an_empty_logbook_yields_no_findings_but_explains_why():
    report = detect_weaknesses(_snapshot())
    assert report.weaknesses == []
    assert len(report.data_gaps) == 4


def test_every_finding_carries_its_evidence():
    report = detect_weaknesses(
        _snapshot(
            climbs=[_climb(days_ago=i, wall_angle="vertical") for i in range(1, 15)],
            sessions=[_session(days_ago=i * 2, rpe=9) for i in range(1, 10)],
        )
    )
    assert report.weaknesses
    for w in report.weaknesses:
        assert w.evidence and all(e for e in w.evidence)
        assert w.advice
        assert 0 <= w.score <= 100
