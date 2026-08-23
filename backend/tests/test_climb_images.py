"""API tests for climb photos: upload, serve, replace, delete, and ownership."""
from datetime import date

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.storage import storage

client = TestClient(app)

# A real 1x1 PNG. The endpoint only checks the declared content type, but
# sending genuine bytes keeps the round-trip assertions meaningful.
PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
    b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _auth(email: str) -> dict:
    r = client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "display_name": "Climber"},
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _climb(headers: dict, name: str = "Cave Classic") -> dict:
    r = client.post(
        "/climbs",
        json={
            "name": name,
            "grade": "V4",
            "climb_type": "boulder",
            "send_type": "redpoint",
            "climbed_on": date.today().isoformat(),
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _upload(climb_id: int, headers: dict, content_type: str = "image/png", data=PNG):
    return client.put(
        f"/climbs/{climb_id}/image",
        files={"file": ("climb.png", data, content_type)},
        headers=headers,
    )


def test_a_new_climb_has_no_image():
    h = _auth("img-new@test.dev")
    assert _climb(h)["has_image"] is False


def test_upload_then_fetch_round_trips_the_bytes():
    h = _auth("img-upload@test.dev")
    climb_id = _climb(h)["id"]

    r = _upload(climb_id, h)
    assert r.status_code == 200, r.text
    assert r.json()["has_image"] is True

    got = client.get(f"/climbs/{climb_id}/image", headers=h)
    assert got.status_code == 200
    assert got.headers["content-type"].startswith("image/png")
    assert got.content == PNG

    # And the list view carries the flag, so a row knows to show a thumbnail.
    listed = client.get("/climbs", headers=h).json()
    assert next(c for c in listed if c["id"] == climb_id)["has_image"] is True


def test_uploading_twice_replaces_rather_than_accumulates():
    h = _auth("img-replace@test.dev")
    climb_id = _climb(h)["id"]

    _upload(climb_id, h)
    first_key = _stored_key(climb_id)
    _upload(climb_id, h, content_type="image/jpeg")
    second_key = _stored_key(climb_id)

    assert first_key != second_key
    assert not storage.exists(first_key), "the replaced file should be cleaned up"
    assert storage.exists(second_key)
    assert client.get(f"/climbs/{climb_id}/image", headers=h).headers[
        "content-type"
    ].startswith("image/jpeg")


def _stored_key(climb_id: int) -> str:
    from sqlalchemy import select

    from app.database import SessionLocal
    from app.models import Climb

    with SessionLocal() as db:
        return db.scalar(select(Climb.image_key).where(Climb.id == climb_id))


def test_unsupported_type_is_rejected():
    h = _auth("img-type@test.dev")
    climb_id = _climb(h)["id"]
    r = _upload(climb_id, h, content_type="image/heic")
    assert r.status_code == 415
    assert "heic" in r.json()["detail"]
    assert client.get(f"/climbs/{climb_id}/image", headers=h).status_code == 404


def test_oversized_image_is_rejected_and_not_left_behind(monkeypatch):
    h = _auth("img-size@test.dev")
    climb_id = _climb(h)["id"]
    monkeypatch.setattr(settings, "max_image_mb", 0)

    r = _upload(climb_id, h)
    assert r.status_code == 413
    assert _stored_key(climb_id) is None
    # The rejected upload must not leave bytes in storage.
    assert client.get(f"/climbs/{climb_id}/image", headers=h).status_code == 404


def test_fetching_a_missing_photo_404s():
    h = _auth("img-missing@test.dev")
    climb_id = _climb(h)["id"]
    r = client.get(f"/climbs/{climb_id}/image", headers=h)
    assert r.status_code == 404
    assert "no photo" in r.json()["detail"].lower()


def test_deleting_the_photo_clears_the_flag_and_the_file():
    h = _auth("img-delete@test.dev")
    climb_id = _climb(h)["id"]
    _upload(climb_id, h)
    key = _stored_key(climb_id)

    r = client.delete(f"/climbs/{climb_id}/image", headers=h)
    assert r.status_code == 200
    assert r.json()["has_image"] is False
    assert not storage.exists(key)
    assert client.get(f"/climbs/{climb_id}/image", headers=h).status_code == 404
    # The climb itself survives.
    assert client.get(f"/climbs/{climb_id}", headers=h).status_code == 200


def test_deleting_the_climb_removes_its_photo_from_storage():
    h = _auth("img-cascade@test.dev")
    climb_id = _climb(h)["id"]
    _upload(climb_id, h)
    key = _stored_key(climb_id)
    assert storage.exists(key)

    assert client.delete(f"/climbs/{climb_id}", headers=h).status_code == 204
    assert not storage.exists(key), "deleting a climb must not orphan its photo"


def test_photos_are_scoped_to_the_owner():
    owner = _auth("img-owner@test.dev")
    other = _auth("img-intruder@test.dev")
    climb_id = _climb(owner)["id"]
    _upload(climb_id, owner)

    assert _upload(climb_id, other).status_code == 404
    assert client.get(f"/climbs/{climb_id}/image", headers=other).status_code == 404
    assert client.delete(f"/climbs/{climb_id}/image", headers=other).status_code == 404
    # Still intact for the owner.
    assert client.get(f"/climbs/{climb_id}/image", headers=owner).status_code == 200


def test_photo_endpoints_require_auth():
    assert client.get("/climbs/1/image").status_code == 401
    assert client.delete("/climbs/1/image").status_code == 401
