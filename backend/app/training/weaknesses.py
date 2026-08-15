"""Pure weakness detection over a training snapshot.

Like the phase 2 pose metrics, these are transparent heuristics rather than a
validated sports-science model — every threshold is a documented, tunable guess,
and each finding carries the numbers behind it so the athlete can disagree with
it. Each detector scores one area 0-100 where *lower means weaker*, and returns
None when there isn't enough logged data to say anything honest; those gaps are
reported separately so the athlete knows what to log to unlock more.

Detectors deliberately mirror how a coach reads a logbook: what terrain you
avoid, whether your pyramid has a base, how you actually perform on the sharp
end, whether you train anything but climbing, and whether you're recovering.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from ..grades import grade_sort_key
from .snapshot import TrainingSnapshot

# Angles grouped into two buckets. Four-way balance is the wrong target — roof
# is genuinely rare for most climbers — but avoiding steep ground entirely is a
# real and very common gap.
STEEP_ANGLES = ("overhang", "roof")
LOW_ANGLES = ("slab", "vertical")

# Minimum sample sizes before a detector will say anything.
MIN_ANGLED_CLIMBS = 10
MIN_PYRAMID_SENDS = 6
MIN_RATE_SENDS = 8
MIN_LOAD_SESSIONS = 6
MIN_TREND_SENDS = 4

# Windows, in days. Videos are sparse, so movement quality looks back furthest.
RECENT_DAYS = 90
MOVEMENT_DAYS = 180
LOAD_DAYS = 28
CONSISTENCY_WEEKS = 8
TREND_DAYS = 30

# Past this point, prescribing dedicated finger training does more harm than
# good — tendons adapt far slower than muscle, and most finger injuries happen
# to climbers who hangboard before they have a base. Either proxy clears it.
HANGBOARD_READY_CLIMBS = 40
# Derived rather than hard-coded: VB leads the V scale, so V4 is not index 4.
HANGBOARD_READY_GRADE = grade_sort_key("V4")


@dataclass(frozen=True)
class Weakness:
    key: str
    label: str
    # Tag the plan generator keys its session templates off.
    focus: str
    score: int  # 0-100, lower = weaker
    severity: str  # high / moderate / low
    summary: str
    evidence: list[str] = field(default_factory=list)
    advice: str = ""


@dataclass(frozen=True)
class WeaknessReport:
    weaknesses: list[Weakness] = field(default_factory=list)
    # Things the athlete isn't logging that would unlock more detectors.
    data_gaps: list[str] = field(default_factory=list)


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _score_higher_better(value: float, good: float, bad: float) -> float:
    """100 when value>=good, 0 when value<=bad, linear between."""
    if value >= good:
        return 100.0
    if value <= bad:
        return 0.0
    return _clamp(100.0 * (value - bad) / (good - bad))


def _score_lower_better(value: float, good: float, bad: float) -> float:
    """100 when value<=good, 0 when value>=bad, linear between."""
    if value <= good:
        return 100.0
    if value >= bad:
        return 0.0
    return _clamp(100.0 * (bad - value) / (bad - good))


def _severity(score: float) -> str:
    if score < 40:
        return "high"
    if score < 65:
        return "moderate"
    return "low"


def _weakness(key: str, label: str, focus: str, score: float, summary: str,
              evidence: list[str], advice: str) -> Weakness:
    rounded = round(score)
    return Weakness(
        key=key,
        label=label,
        focus=focus,
        score=rounded,
        severity=_severity(rounded),
        summary=summary,
        evidence=evidence,
        advice=advice,
    )


# ---------- Detectors ----------


def _angle_coverage(s: TrainingSnapshot) -> Weakness | None:
    """Whether the athlete climbs across both steep and low-angle terrain."""
    angled = [c for c in s.climbs_since(RECENT_DAYS) if c.wall_angle]
    if len(angled) < MIN_ANGLED_CLIMBS:
        return None

    counts = Counter(c.wall_angle for c in angled)
    steep = sum(counts[a] for a in STEEP_ANGLES) / len(angled)
    low = sum(counts[a] for a in LOW_ANGLES) / len(angled)

    # An even split would be 50/50; 30% is the floor we treat as "covered".
    neglected_share, focus, label_terrain = (
        (steep, "steep_terrain", "steep ground")
        if steep <= low
        else (low, "slab_technique", "slab and vertical")
    )
    score = _score_higher_better(neglected_share, good=0.30, bad=0.05)
    return _weakness(
        key="angle_coverage",
        label="Wall angle coverage",
        focus=focus,
        score=score,
        summary=f"Only {neglected_share:.0%} of your recent climbing is on {label_terrain}.",
        evidence=[
            f"{steep:.0%} steep (overhang/roof) vs {low:.0%} low-angle (slab/vertical)",
            f"across {len(angled)} climbs with a logged angle in the last {RECENT_DAYS} days",
        ],
        advice=(
            "Terrain you avoid is terrain you're weak on. Spend a full session a "
            f"week on {label_terrain} until it stops feeling foreign."
        ),
    )


def _pyramid_base(s: TrainingSnapshot) -> Weakness | None:
    """A healthy pyramid has more sends at each grade than the one above it."""
    sends = [c for c in s.climbs if c.is_send and c.is_boulder and c.grade_value >= 0]
    if len(sends) < MIN_PYRAMID_SENDS:
        return None

    counts = Counter(c.grade_value for c in sends)
    top = max(counts)
    n_top = counts[top]
    n_below = counts.get(top - 1, 0)
    top_grade = next(c.grade for c in sends if c.grade_value == top)

    # Rule of thumb: roughly double the sends one grade down.
    ratio = n_below / n_top
    score = _score_higher_better(ratio, good=2.0, bad=0.5)
    return _weakness(
        key="pyramid_base",
        label="Pyramid base",
        focus="mileage",
        score=score,
        summary=(
            f"Your pyramid is narrow under {top_grade} — "
            f"{n_below} send{'s' if n_below != 1 else ''} one grade below "
            f"{n_top} at the top."
        ),
        evidence=[
            f"{n_top} send{'s' if n_top != 1 else ''} at {top_grade}",
            f"{n_below} one grade below (a solid base is roughly double)",
        ],
        advice=(
            "Chasing the next grade off a thin base is how plateaus start. Bank "
            "volume one and two grades below your max until the base is wide."
        ),
    )


def _movement_quality(s: TrainingSnapshot) -> Weakness | None:
    """Weakest of the four pose metrics, averaged over recent analyses."""
    analyses = s.analyses_since(MOVEMENT_DAYS)
    if not analyses:
        return None

    totals: dict[str, list[int]] = {}
    for a in analyses:
        for key, score in a.metric_scores.items():
            totals.setdefault(key, []).append(score)
    if not totals:
        return None

    averages = {k: sum(v) / len(v) for k, v in totals.items()}
    worst_key = min(averages, key=lambda k: averages[k])
    worst = averages[worst_key]

    meta = {
        "hip_position": ("Hip position", "technique_hips",
                         "Hips drifting off the wall loads your arms on every move."),
        "cog_stability": ("Center-of-gravity control", "movement_control",
                          "Lurching between holds burns energy you need for the crux."),
        "foot_control": ("Silent feet", "technique_feet",
                         "Busy, noisy feet cost precision and confidence on small holds."),
        "body_tension": ("Body tension", "core_tension",
                         "Leaking tension is what makes steep ground feel impossible."),
    }
    label, focus, advice = meta.get(
        worst_key, (worst_key.replace("_", " ").title(), "technique_feet", "")
    )
    return _weakness(
        key="movement_quality",
        label=f"Movement — {label.lower()}",
        focus=focus,
        score=worst,
        summary=f"{label} is your lowest movement score at {worst:.0f}/100.",
        evidence=[
            f"averaged over {len(analyses)} analyzed video"
            f"{'s' if len(analyses) != 1 else ''}",
            ", ".join(f"{k.replace('_', ' ')} {v:.0f}" for k, v in sorted(averages.items())),
        ],
        advice=advice,
    )


def _first_try_rate(s: TrainingSnapshot) -> Weakness | None:
    """How often sends come first go — reading, commitment, and execution."""
    sends = [c for c in s.climbs_since(MOVEMENT_DAYS) if c.is_send]
    if len(sends) < MIN_RATE_SENDS:
        return None

    first_try = [c for c in sends if c.send_type in ("flash", "onsight")]
    rate = len(first_try) / len(sends)
    # 35% first-go is a strong rate for someone climbing near their limit.
    score = _score_higher_better(rate, good=0.35, bad=0.05)
    return _weakness(
        key="first_try_rate",
        label="First-go success",
        focus="route_reading",
        score=score,
        summary=f"{rate:.0%} of your sends came first go.",
        evidence=[
            f"{len(first_try)} flash/onsight out of {len(sends)} sends",
            f"in the last {MOVEMENT_DAYS} days",
        ],
        advice=(
            "A low flash rate usually means reading, not strength. Commit to a "
            "full sequence from the ground before pulling on, and don't rehearse."
        ),
    )


def _finger_strength(s: TrainingSnapshot) -> Weakness | None:
    """Presence of dedicated strength work — gated on having a climbing base."""
    hardest = max((c.grade_value for c in s.climbs if c.is_send and c.is_boulder),
                  default=-1)
    experienced = (
        len(s.climbs) >= HANGBOARD_READY_CLIMBS or hardest >= HANGBOARD_READY_GRADE
    )
    if not experienced:
        # Deliberately silent: the right answer for a newer climber is more
        # climbing, not a hangboard, and this engine shouldn't nudge otherwise.
        return None

    recent = s.sessions_since(RECENT_DAYS)
    if len(recent) < MIN_LOAD_SESSIONS:
        return None

    strength = [x for x in recent if x.is_strength_work]
    per_month = len(strength) / (RECENT_DAYS / 30)
    # Two dedicated sessions a week is a full block; one a week maintains.
    score = _score_higher_better(per_month, good=4.0, bad=0.0)
    return _weakness(
        key="finger_strength",
        label="Dedicated strength work",
        focus="finger_strength",
        score=score,
        summary=(
            f"{per_month:.1f} dedicated strength sessions a month "
            f"alongside {len(recent)} sessions of climbing."
        ),
        evidence=[
            f"{len(strength)} hangboard/campus/weighted session"
            f"{'s' if len(strength) != 1 else ''} in {RECENT_DAYS} days",
            f"out of {len(recent)} logged sessions",
        ],
        advice=(
            "Climbing alone stops building finger strength once you have a base. "
            "Two short, quality hangboard sessions a week move the needle."
        ),
    )


def _consistency(s: TrainingSnapshot) -> Weakness | None:
    """Share of recent weeks containing at least one session."""
    window_days = CONSISTENCY_WEEKS * 7
    recent = s.sessions_since(window_days)
    if len(recent) < MIN_LOAD_SESSIONS:
        return None

    weeks_trained = {(s.today - x.session_date).days // 7 for x in recent}
    coverage = len(weeks_trained) / CONSISTENCY_WEEKS
    score = _score_higher_better(coverage, good=0.875, bad=0.375)  # 7/8 vs 3/8 weeks
    return _weakness(
        key="consistency",
        label="Training consistency",
        focus="consistency",
        score=score,
        summary=(
            f"You trained in {len(weeks_trained)} of the last "
            f"{CONSISTENCY_WEEKS} weeks."
        ),
        evidence=[
            f"{len(recent)} sessions across {len(weeks_trained)} distinct weeks",
            f"{len(recent) / CONSISTENCY_WEEKS:.1f} sessions per week on average",
        ],
        advice=(
            "Three moderate weeks beat one heroic week and two off. Protect a "
            "minimum floor — even a short session keeps the adaptation going."
        ),
    )


def _recovery_load(s: TrainingSnapshot) -> Weakness | None:
    """Overreaching risk: sustained high RPE and too many hard days a week.

    Scored so that a *high* training load produces a *low* score, because in
    this engine low always means "needs attention".
    """
    rated = [x for x in s.sessions_since(LOAD_DAYS) if x.rpe is not None]
    if len(rated) < MIN_LOAD_SESSIONS:
        return None

    avg_rpe = sum(x.rpe for x in rated) / len(rated)
    hard_per_week = len([x for x in rated if x.rpe >= 8]) / (LOAD_DAYS / 7)

    # Worst of the two signals wins — either alone is enough to matter.
    score = min(
        _score_lower_better(avg_rpe, good=6.5, bad=9.0),
        _score_lower_better(hard_per_week, good=2.0, bad=4.0),
    )
    return _weakness(
        key="recovery_load",
        label="Recovery and load",
        focus="recovery",
        score=score,
        summary=(
            f"Average RPE {avg_rpe:.1f} with {hard_per_week:.1f} hard sessions "
            f"a week over the last {LOAD_DAYS} days."
        ),
        evidence=[
            f"{len(rated)} sessions with a logged RPE",
            f"{len([x for x in rated if x.rpe >= 8])} of them at RPE 8 or above",
        ],
        advice=(
            "Climbing injuries come from doing too much too soon far more often "
            "than from doing too little. Cap hard days at two a week and put a "
            "genuine rest day either side."
        ),
    )


def _volume_trend(s: TrainingSnapshot) -> Weakness | None:
    """Whether send volume is holding up against the previous month."""
    current = [c for c in s.climbs_since(TREND_DAYS) if c.is_send]
    previous = [c for c in s.climbs_between(TREND_DAYS * 2, TREND_DAYS) if c.is_send]
    if len(previous) < MIN_TREND_SENDS:
        return None

    ratio = len(current) / len(previous)
    score = _score_higher_better(ratio, good=1.0, bad=0.3)
    return _weakness(
        key="volume_trend",
        label="Volume trend",
        focus="mileage",
        score=score,
        summary=(
            f"{len(current)} sends in the last {TREND_DAYS} days versus "
            f"{len(previous)} the month before."
        ),
        evidence=[f"{ratio:.0%} of the previous month's send volume"],
        advice=(
            "Volume drifting down is usually life, not fitness — but it compounds. "
            "Rebuild with easier, higher-count sessions before chasing grades."
        ),
    )


_DETECTORS = (
    _recovery_load,  # safety-adjacent, so it leads ties
    _angle_coverage,
    _pyramid_base,
    _movement_quality,
    _first_try_rate,
    _finger_strength,
    _consistency,
    _volume_trend,
)


def _data_gaps(s: TrainingSnapshot, found: list[Weakness]) -> list[str]:
    keys = {w.key for w in found}
    gaps = []
    if "angle_coverage" not in keys:
        gaps.append(
            "Log a wall angle on your climbs to see which terrain you're avoiding."
        )
    if "movement_quality" not in keys:
        gaps.append(
            "Upload a climbing video for movement analysis to fold technique in."
        )
    if "recovery_load" not in keys:
        gaps.append("Log an RPE on your sessions to track recovery and load.")
    if "pyramid_base" not in keys:
        gaps.append(f"Log at least {MIN_PYRAMID_SENDS} boulder sends to build a pyramid.")
    return gaps


def detect_weaknesses(snapshot: TrainingSnapshot) -> WeaknessReport:
    """Score every assessable area, weakest first."""
    found = [w for detector in _DETECTORS if (w := detector(snapshot)) is not None]
    found.sort(key=lambda w: w.score)
    return WeaknessReport(weaknesses=found, data_gaps=_data_gaps(snapshot, found))
