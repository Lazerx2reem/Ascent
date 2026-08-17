"""API tests for weakness detection and training plan generation."""
import json
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.coach.tools import run_tool
from app.database import SessionLocal
from app.main import app
from app.models import User

client = TestClient(app)


def _auth(email: str) -> dict:
    r = client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "display_name": "Athlete"},
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _log_vertical_block(headers: dict, count: int = 12) -> None:
    """Enough same-angle climbing to trip the angle-coverage detector."""
    for i in range(count):
        r = client.post(
            "/climbs",
            json={
                "name": f"Problem {i}",
                "grade": "V4",
                "climb_type": "boulder",
                "wall_angle": "vertical",
                "send_type": "redpoint",
                "attempt_count": 3,
                "climbed_on": (date.today() - timedelta(days=i + 1)).isoformat(),
            },
            headers=headers,
        )
        assert r.status_code == 201, r.text


# ---------- Weaknesses ----------


def test_weaknesses_require_auth():
    assert client.get("/training/weaknesses").status_code == 401


def test_an_empty_logbook_reports_gaps_rather_than_findings():
    h = _auth("empty-weakness@test.dev")
    body = client.get("/training/weaknesses", headers=h).json()
    assert body["weaknesses"] == []
    assert body["data_gaps"]


def test_weaknesses_reflect_the_logbook():
    h = _auth("weakness@test.dev")
    _log_vertical_block(h)

    body = client.get("/training/weaknesses", headers=h).json()
    keys = [w["key"] for w in body["weaknesses"]]
    assert "angle_coverage" in keys

    angle = next(w for w in body["weaknesses"] if w["key"] == "angle_coverage")
    assert angle["focus"] == "steep_terrain"
    assert angle["severity"] == "high"
    assert angle["evidence"]
    # Ranked weakest-first.
    scores = [w["score"] for w in body["weaknesses"]]
    assert scores == sorted(scores)


def test_weaknesses_are_scoped_to_the_athlete():
    h1 = _auth("weakness-owner@test.dev")
    h2 = _auth("weakness-other@test.dev")
    _log_vertical_block(h1)

    assert client.get("/training/weaknesses", headers=h2).json()["weaknesses"] == []


# ---------- Plans ----------


def test_generating_a_plan_persists_it_with_sessions():
    h = _auth("plan@test.dev")
    _log_vertical_block(h)

    r = client.post("/training/plans", json={"weeks": 4, "days_per_week": 3}, headers=h)
    assert r.status_code == 201, r.text
    plan = r.json()

    assert plan["weeks"] == 4 and plan["days_per_week"] == 3
    assert len(plan["sessions"]) == 12
    assert plan["focus_areas"]
    assert plan["summary"]
    assert plan["weaknesses"], "the plan records what it was built from"
    # Steep terrain is the obvious gap for a vertical-only logbook.
    assert any(s["focus"] == "steep_terrain" for s in plan["sessions"])
    # Blocks carry loggable detail.
    assert plan["sessions"][0]["blocks"][0]["sets"] >= 1


def test_plan_title_defaults_to_its_focus():
    h = _auth("plan-title@test.dev")
    _log_vertical_block(h)
    plan = client.post("/training/plans", json={}, headers=h).json()
    assert plan["title"].startswith("4-week block —")


def test_a_custom_title_is_kept():
    h = _auth("plan-custom-title@test.dev")
    _log_vertical_block(h)
    plan = client.post(
        "/training/plans", json={"title": "Winter block"}, headers=h
    ).json()
    assert plan["title"] == "Winter block"


def test_a_stored_plan_keeps_the_weaknesses_it_was_built_from():
    h = _auth("plan-frozen@test.dev")
    _log_vertical_block(h)
    created = client.post("/training/plans", json={}, headers=h).json()

    # The logbook moves on — the stored plan must not silently re-reason.
    for i in range(12):
        client.post(
            "/climbs",
            json={
                "name": f"Steep {i}",
                "grade": "V4",
                "climb_type": "boulder",
                "wall_angle": "overhang",
                "send_type": "flash",
                "climbed_on": date.today().isoformat(),
            },
            headers=h,
        )

    fetched = client.get(f"/training/plans/{created['id']}", headers=h).json()
    assert fetched["weaknesses"] == created["weaknesses"]
    assert fetched["sessions"] == created["sessions"]

    # A freshly generated plan does reflect the new data.
    regenerated = client.post("/training/plans", json={}, headers=h).json()
    assert regenerated["weaknesses"] != created["weaknesses"]


def test_plan_list_detail_and_ownership():
    h1 = _auth("plan-owner@test.dev")
    h2 = _auth("plan-intruder@test.dev")
    _log_vertical_block(h1)
    plan_id = client.post("/training/plans", json={}, headers=h1).json()["id"]

    listed = client.get("/training/plans", headers=h1).json()
    assert any(p["id"] == plan_id for p in listed)
    # List rows stay light — no session bodies.
    assert "sessions" not in listed[0]

    assert client.get("/training/plans", headers=h2).json() == []
    assert client.get(f"/training/plans/{plan_id}", headers=h2).status_code == 404
    assert client.delete(f"/training/plans/{plan_id}", headers=h2).status_code == 404

    assert client.delete(f"/training/plans/{plan_id}", headers=h1).status_code == 204
    assert client.get(f"/training/plans/{plan_id}", headers=h1).status_code == 404


def test_out_of_range_plan_shapes_are_rejected():
    h = _auth("plan-range@test.dev")
    assert client.post("/training/plans", json={"weeks": 99}, headers=h).status_code == 422
    assert (
        client.post("/training/plans", json={"days_per_week": 0}, headers=h).status_code
        == 422
    )


def test_a_plan_can_be_generated_from_an_empty_logbook():
    h = _auth("plan-empty@test.dev")
    plan = client.post("/training/plans", json={}, headers=h).json()
    assert plan["sessions"], "a new athlete still gets a maintenance block"
    assert plan["weaknesses"] == []


# ---------- Coach integration ----------


def test_the_coach_can_read_the_same_weaknesses():
    email = "coach-weakness@test.dev"
    h = _auth(email)
    _log_vertical_block(h)

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        result = json.loads(run_tool("get_weaknesses", {}, user, db))

    keys = [w["key"] for w in result["weaknesses"]]
    assert "angle_coverage" in keys
    assert result["weaknesses"][0]["evidence"]
    assert "data_gaps" in result

    # And it matches what the training endpoint reports.
    api_keys = [w["key"] for w in client.get("/training/weaknesses", headers=h).json()["weaknesses"]]
    assert keys == api_keys
