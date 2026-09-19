"""API tests for the endpoints behind the profile page and climb editing."""
from datetime import date

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _auth(email: str) -> dict:
    r = client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "display_name": "Climber"},
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _climb(headers: dict) -> dict:
    r = client.post(
        "/climbs",
        json={
            "name": "Cave Classic",
            "grade": "V4",
            "climb_type": "boulder",
            "send_type": "project",
            "attempt_count": 3,
            "climbed_on": date.today().isoformat(),
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_new_account_profile_starts_empty():
    headers = _auth("profile-empty@example.com")
    me = client.get("/auth/me", headers=headers).json()
    assert me["display_name"] == "Climber"
    for field in ("climbing_style", "home_gym", "grade_range_boulder", "goals"):
        assert me[field] is None


def test_profile_update_round_trips_and_can_clear_fields():
    headers = _auth("profile-update@example.com")
    r = client.patch(
        "/auth/me",
        json={
            "climbing_style": "boulder",
            "home_gym": "Boulder Barn",
            "grade_range_boulder": "V4-V6",
            "goals": "Send V7 outdoors.",
        },
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["grade_range_boulder"] == "V4-V6"

    # The profile page sends null for a field the user emptied.
    r = client.patch("/auth/me", json={"home_gym": None}, headers=headers)
    me = r.json()
    assert me["home_gym"] is None
    assert me["climbing_style"] == "boulder"  # untouched fields survive


def test_profile_rejects_blank_name():
    headers = _auth("profile-blank@example.com")
    r = client.patch("/auth/me", json={"display_name": ""}, headers=headers)
    assert r.status_code == 422


def test_edit_climb_updates_fields():
    headers = _auth("edit-climb@example.com")
    climb = _climb(headers)
    r = client.patch(
        f"/climbs/{climb['id']}",
        json={"grade": "V5", "send_type": "redpoint", "notes": "Heel hook at the lip."},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    edited = r.json()
    assert (edited["grade"], edited["send_type"]) == ("V5", "redpoint")
    assert edited["attempt_count"] == 3  # not in the patch, so unchanged
    assert client.get(f"/climbs/{climb['id']}", headers=headers).json()["grade"] == "V5"


def test_edit_climb_validates_and_is_owner_only():
    owner = _auth("edit-owner@example.com")
    other = _auth("edit-other@example.com")
    climb = _climb(owner)

    r = client.patch(f"/climbs/{climb['id']}", json={"attempt_count": 0}, headers=owner)
    assert r.status_code == 422

    r = client.patch(f"/climbs/{climb['id']}", json={"grade": "V9"}, headers=other)
    assert r.status_code == 404
