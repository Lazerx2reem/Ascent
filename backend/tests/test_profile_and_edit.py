"""API tests for the endpoints behind the profile page."""
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
