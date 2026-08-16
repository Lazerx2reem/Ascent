"""Tools the coach can call to read the athlete's own training data.

Every tool is scoped to a single user — the `user` passed to `run_tool` comes
from the JWT, never from the model — so there is no way for a tool call to reach
another athlete's rows. Results are compact JSON: tool output lands in the
context window on every subsequent turn of the loop, so these return the fields
a coach would actually reason about rather than whole ORM rows.
"""
from __future__ import annotations

import json
from collections import Counter
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..grades import SEND_TYPES, grade_sort_key
from ..models import Climb, PoseAnalysis, TrainingSession, User, Video

# Ceilings so a chatty tool call can't blow out the context window.
MAX_CLIMBS = 60
MAX_SESSIONS = 60
MAX_VIDEOS = 20


TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "get_training_summary",
        "description": (
            "Overall training picture: lifetime totals, hardest boulder and route "
            "sent, and volume over a recent window (climbs, sends, sessions, hours, "
            "average RPE). Call this first for any broad question — 'how am I "
            "doing', 'what should I work on', 'am I improving' — to orient before "
            "pulling detail with the other tools."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Length of the recent window, in days. Defaults to 30.",
                }
            },
        },
    },
    {
        "name": "get_recent_climbs",
        "description": (
            "The athlete's logged climbs, newest first, with grade, angle, send "
            "type, attempt count, and their own notes. Call this when the question "
            "touches specific climbs, projects, styles, or angles — including "
            "'what am I struggling with', since the notes usually say. Filter by "
            "days/climb_type/send_type rather than pulling everything."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Only climbs logged within this many days. Omit for all time.",
                },
                "climb_type": {
                    "type": "string",
                    "enum": ["boulder", "sport", "trad"],
                    "description": "Restrict to one discipline.",
                },
                "send_type": {
                    "type": "string",
                    "enum": ["flash", "onsight", "redpoint", "repeat", "project"],
                    "description": "Restrict to one outcome. Use 'project' for unsent work.",
                },
                "limit": {
                    "type": "integer",
                    "description": f"Max climbs to return (default 25, cap {MAX_CLIMBS}).",
                },
            },
        },
    },
    {
        "name": "get_grade_pyramid",
        "description": (
            "Send counts per grade, hardest first. Call this for questions about "
            "readiness to step up a grade, whether their pyramid is top-heavy, or "
            "where their base is thin."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "discipline": {
                    "type": "string",
                    "enum": ["boulder", "route"],
                    "description": "Which pyramid to build. Defaults to boulder.",
                }
            },
        },
    },
    {
        "name": "get_recent_sessions",
        "description": (
            "Logged training sessions, newest first: date, type, duration, RPE, "
            "structured workout details, and notes. Call this for anything about "
            "load, recovery, rest-day spacing, session frequency, or what their "
            "hangboard and campus work actually looks like."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Only sessions within this many days. Omit for all time.",
                },
                "session_type": {
                    "type": "string",
                    "enum": ["gym", "board", "outdoor", "hangboard", "other"],
                    "description": "Restrict to one session type.",
                },
                "limit": {
                    "type": "integer",
                    "description": f"Max sessions to return (default 25, cap {MAX_SESSIONS}).",
                },
            },
        },
    },
    {
        "name": "list_video_analyses",
        "description": (
            "Every analyzed climbing video with its overall movement score and the "
            "four metric scores, newest first. Call this for questions about "
            "technique or movement quality, or to find which clip to inspect."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": f"Max videos to return (default 10, cap {MAX_VIDEOS}).",
                }
            },
        },
    },
    {
        "name": "get_weaknesses",
        "description": (
            "The athlete's ranked weaknesses, weakest first, each with a 0-100 "
            "score (lower is weaker), the evidence behind it, and what it implies. "
            "Covers wall-angle coverage, pyramid base, movement quality, first-go "
            "rate, strength work, consistency, recovery load, and volume trend. "
            "Call this for 'what should I work on' or 'what's holding me back' — "
            "it is the same analysis the training plan generator uses, so your "
            "answer will line up with any plan they have. Also returns data_gaps: "
            "things they aren't logging that would sharpen the picture."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_video_analysis",
        "description": (
            "Full pose analysis for one video: every metric with its measured "
            "value and score, plus the severity-ranked coaching notes. Call this "
            "after list_video_analyses when discussing a specific attempt in depth."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "video_id": {
                    "type": "integer",
                    "description": "id from list_video_analyses.",
                }
            },
            "required": ["video_id"],
        },
    },
]


def _clamp(value, default: int, cap: int) -> int:
    """Tool inputs are model-generated — coerce them into a sane range."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(n, cap))


def _since(days) -> date | None:
    if days is None:
        return None
    try:
        n = int(days)
    except (TypeError, ValueError):
        return None
    return date.today() - timedelta(days=max(1, n))


def _is_send(climb: Climb) -> bool:
    return climb.send_type in SEND_TYPES


# ---------- Individual tools ----------


def _training_summary(user: User, db: Session, args: dict) -> dict:
    days = _clamp(args.get("days"), default=30, cap=3650)
    since = date.today() - timedelta(days=days)

    climbs = list(db.scalars(select(Climb).where(Climb.user_id == user.id)))
    sessions = list(
        db.scalars(select(TrainingSession).where(TrainingSession.user_id == user.id))
    )
    sends = [c for c in climbs if _is_send(c)]
    recent_climbs = [c for c in climbs if c.climbed_on >= since]
    recent_sessions = [s for s in sessions if s.session_date >= since]
    rpes = [s.rpe for s in recent_sessions if s.rpe is not None]

    return {
        "all_time": {
            "climbs_logged": len(climbs),
            "sends": len(sends),
            "sessions": len(sessions),
            "hours": round(sum(s.duration_minutes for s in sessions) / 60, 1),
            "hardest_boulder": max(
                (c.grade for c in sends if c.climb_type == "boulder"),
                key=grade_sort_key,
                default=None,
            ),
            "hardest_route": max(
                (c.grade for c in sends if c.climb_type in ("sport", "trad")),
                key=grade_sort_key,
                default=None,
            ),
        },
        f"last_{days}_days": {
            "climbs_logged": len(recent_climbs),
            "sends": len([c for c in recent_climbs if _is_send(c)]),
            "sessions": len(recent_sessions),
            "hours": round(sum(s.duration_minutes for s in recent_sessions) / 60, 1),
            "avg_rpe": round(sum(rpes) / len(rpes), 1) if rpes else None,
            "hardest_send": max(
                (c.grade for c in recent_climbs if _is_send(c)),
                key=grade_sort_key,
                default=None,
            ),
        },
    }


def _recent_climbs(user: User, db: Session, args: dict) -> dict:
    limit = _clamp(args.get("limit"), default=25, cap=MAX_CLIMBS)
    query = select(Climb).where(Climb.user_id == user.id)
    if (since := _since(args.get("days"))) is not None:
        query = query.where(Climb.climbed_on >= since)
    if args.get("climb_type"):
        query = query.where(Climb.climb_type == args["climb_type"])
    if args.get("send_type"):
        query = query.where(Climb.send_type == args["send_type"])
    query = query.order_by(Climb.climbed_on.desc(), Climb.id.desc()).limit(limit)

    climbs = list(db.scalars(query))
    return {
        "count": len(climbs),
        "climbs": [
            {
                "date": c.climbed_on.isoformat(),
                "name": c.name,
                "grade": c.grade,
                "type": c.climb_type,
                "angle": c.wall_angle,
                "location": c.location,
                "outcome": c.send_type,
                "attempts": c.attempt_count,
                "notes": c.notes,
            }
            for c in climbs
        ],
    }


def _grade_pyramid(user: User, db: Session, args: dict) -> dict:
    discipline = args.get("discipline") or "boulder"
    types = ("boulder",) if discipline == "boulder" else ("sport", "trad")
    sends = [
        c
        for c in db.scalars(select(Climb).where(Climb.user_id == user.id))
        if _is_send(c) and c.climb_type in types
    ]
    counts = Counter(c.grade for c in sends)
    ordered = sorted(counts, key=grade_sort_key, reverse=True)
    return {
        "discipline": discipline,
        "pyramid": [{"grade": g, "sends": counts[g]} for g in ordered],
    }


def _recent_sessions(user: User, db: Session, args: dict) -> dict:
    limit = _clamp(args.get("limit"), default=25, cap=MAX_SESSIONS)
    query = select(TrainingSession).where(TrainingSession.user_id == user.id)
    if (since := _since(args.get("days"))) is not None:
        query = query.where(TrainingSession.session_date >= since)
    if args.get("session_type"):
        query = query.where(TrainingSession.session_type == args["session_type"])
    query = query.order_by(
        TrainingSession.session_date.desc(), TrainingSession.id.desc()
    ).limit(limit)

    sessions = list(db.scalars(query))
    return {
        "count": len(sessions),
        "sessions": [
            {
                "date": s.session_date.isoformat(),
                "type": s.session_type,
                "minutes": s.duration_minutes,
                "rpe": s.rpe,
                "workout": s.workout_details,
                "notes": s.notes,
            }
            for s in sessions
        ],
    }


def _list_video_analyses(user: User, db: Session, args: dict) -> dict:
    limit = _clamp(args.get("limit"), default=10, cap=MAX_VIDEOS)
    query = (
        select(Video)
        .join(PoseAnalysis, PoseAnalysis.video_id == Video.id)
        .where(Video.user_id == user.id)
        .order_by(Video.created_at.desc(), Video.id.desc())
        .limit(limit)
    )
    videos = list(db.scalars(query))
    return {
        "count": len(videos),
        "videos": [
            {
                "video_id": v.id,
                "filename": v.original_filename,
                "uploaded": v.created_at.date().isoformat(),
                "climb_id": v.climb_id,
                "overall_score": v.analysis.overall_score,
                "scores": {
                    key: metric.get("score")
                    for key, metric in (v.analysis.metrics or {}).items()
                },
                "is_sample": v.analysis.source == "synthetic",
            }
            for v in videos
            if v.analysis is not None
        ],
    }


def _get_video_analysis(user: User, db: Session, args: dict) -> dict:
    video = db.get(Video, args.get("video_id"))
    if video is None or video.user_id != user.id or video.analysis is None:
        return {"error": "No analyzed video with that id for this athlete."}
    a = video.analysis
    return {
        "video_id": video.id,
        "filename": video.original_filename,
        "uploaded": video.created_at.date().isoformat(),
        "overall_score": a.overall_score,
        "is_sample": a.source == "synthetic",
        "metrics": a.metrics,
        "feedback": a.feedback,
    }


def _weaknesses(user: User, db: Session, args: dict) -> dict:
    # Imported here so the coach package doesn't depend on the training package
    # at import time — they are independent features that happen to share data.
    from ..training.snapshot import build_snapshot
    from ..training.weaknesses import detect_weaknesses

    report = detect_weaknesses(build_snapshot(user, db))
    return {
        "weaknesses": [
            {
                "key": w.key,
                "label": w.label,
                "score": w.score,
                "severity": w.severity,
                "summary": w.summary,
                "evidence": w.evidence,
            }
            for w in report.weaknesses
        ],
        "data_gaps": report.data_gaps,
    }


_DISPATCH = {
    "get_training_summary": _training_summary,
    "get_weaknesses": _weaknesses,
    "get_recent_climbs": _recent_climbs,
    "get_grade_pyramid": _grade_pyramid,
    "get_recent_sessions": _recent_sessions,
    "list_video_analyses": _list_video_analyses,
    "get_video_analysis": _get_video_analysis,
}


def run_tool(name: str, tool_input: dict, user: User, db: Session) -> str:
    """Execute one coach tool and return its JSON result.

    Never raises: an unknown tool or a failed query comes back as an error
    payload so the model can adapt instead of the whole turn dying.
    """
    handler = _DISPATCH.get(name)
    if handler is None:
        return json.dumps({"error": f"Unknown tool {name!r}."})
    try:
        result = handler(user, db, tool_input or {})
    except Exception as exc:  # noqa: BLE001 — surface to the model, not the user
        result = {"error": f"Tool {name} failed: {exc}"}
    return json.dumps(result, default=str)
