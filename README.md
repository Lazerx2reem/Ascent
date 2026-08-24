# Ascent — AI-Powered Rock Climbing Companion

"Strava meets a climbing coach." Training logs, send tracking, and (coming soon)
AI-powered video analysis of climbing attempts.

## Stack

| Layer    | Tech                                      |
| -------- | ----------------------------------------- |
| Frontend | Next.js + TypeScript + Tailwind CSS       |
| Backend  | FastAPI (Python) + SQLAlchemy + Alembic   |
| Database | PostgreSQL                                |
| AI       | OpenCV + MediaPipe Pose (phase 2), Claude API coach (phase 3) |

## Roadmap

- [x] **Phase 1** — auth, logbook, session tracker, stats dashboard
- [x] **Phase 2** — video upload + pose-analysis pipeline
- [x] **Phase 3** — AI coach chat
- [x] **Phase 4** — weakness detection + training plan generator
- [ ] **Phase 5** — stretch features (board import, conditions, community feed)

## Quickstart

### 1. One-time setup

```bash
# Database — either run Postgres via Docker:
docker compose up -d db
# ...or skip Docker and use SQLite for local dev:
echo 'DATABASE_URL=sqlite:///./dev.db' > backend/.env

# Backend deps (3.12: MediaPipe in phase 2 needs <=3.12)
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # apply migrations
python -m app.seed            # optional: demo user + realistic mock data
cd ..

# Frontend + root deps
npm install
cd frontend && npm install && cd ..
```

### 2. Run everything

```bash
npm run dev    # FastAPI on :8000 + Next.js on :3000, one terminal
```

API docs at http://localhost:8000/docs, app at http://localhost:3000.
(`npm run dev:api` / `npm run dev:web` still run either half alone.)

### Demo login (after seeding)

- email: `demo@ascent.app`
- password: `demo1234`

## Climb photos

Logging a climb takes an optional photo, and clicking any row in the logbook
opens that climb — the picture full width, its details, and its notes. Photos
can also be added, replaced, or removed later from the detail page.

Bytes go to the same pluggable store the video uploads use (local disk under
`media/climbs/` in dev, S3-shaped for later); the climb row holds only the
storage key. Deleting a climb deletes its photo, so nothing is left stranded.

JPEG, PNG, WebP and GIF up to 10 MB (`MAX_IMAGE_MB`). HEIC is refused on
purpose — phones produce it, but no browser renders it in an `<img>`, so
accepting it would store files the logbook could never display.

```bash
cd backend && .venv/bin/pytest tests/test_climb_images.py
```

## Video analysis (phase 2)

Under **Analysis**, upload a climbing attempt (mp4/mov/webm/mkv). The backend
runs MediaPipe Pose over the clip and scores four movement fundamentals — hip
position relative to the wall, center-of-gravity control, silent feet, and body
tension — each 0–100 with severity-ranked coaching notes. Analysis runs as a
background task; the UI polls until it's ready.

No climbing video handy? Click **Try a sample analysis** (or run the seed) to
generate a synthetic, already-analyzed attempt so the whole flow is testable
without a real upload. The metrics engine (`app/analysis/metrics.py`) is pure
and unit-tested independently of MediaPipe.

```bash
cd backend && .venv/bin/pytest      # metrics + video API tests
```

## AI coach (phase 3)

Under **Coach**, chat with a climbing coach backed by the Claude API. It isn't
given a canned summary of your training — it holds tools over your own data
(`get_training_summary`, `get_recent_climbs`, `get_grade_pyramid`,
`get_recent_sessions`, `list_video_analyses`, `get_video_analysis`) and decides
what to read to answer the question. Every tool is scoped to the authenticated
user, so a conversation can only ever reach your own rows. The UI shows what it
consulted above each reply.

Replies stream over SSE, because a turn may take several tool round-trips before
the first word exists. Conversations persist, so you can pick one back up later.

Set `ANTHROPIC_API_KEY` in `backend/.env` to enable it — without a key the coach
page explains what's missing and the rest of the app is unaffected. Model and
reasoning effort are configurable (`COACH_MODEL`, `COACH_EFFORT`).

```bash
cd backend && .venv/bin/pytest tests/test_coach.py   # tools, prompt, SSE plumbing
```

The tests fake the model turn, so the suite needs no API key.

## Weakness detection & training plans (phase 4)

Under **Training**, Ascent scores eight areas of your climbing 0&ndash;100 — where
**lower means weaker** — and ranks them worst first:

| Area | What it reads |
| ---- | ------------- |
| Wall angle coverage | steep vs low-angle split across logged climbs |
| Pyramid base | sends one grade below your max vs at it |
| Movement quality | weakest of the four pose metrics, averaged over videos |
| First-go success | flash/onsight share of your sends |
| Dedicated strength work | hangboard/campus/weighted sessions per month |
| Consistency | share of recent weeks containing a session |
| Recovery and load | average RPE and hard sessions per week |
| Volume trend | this month's sends against last month's |

Every finding carries the numbers behind it, so you can disagree with it. A
detector stays silent rather than guessing when there isn't enough logged data,
and says what to log instead — no wall angles means no angle finding.

Two judgment calls are baked in. Dedicated finger training is never suggested to
a climber without a base, since tendons adapt far slower than muscle and that's
where finger injuries come from. And a high recovery-load finding overrides the
rest of the plan: it caps the week and steps the block down rather than building.

The generator turns the ranked weaknesses into a periodized block — up to three
focus areas, sets ramping for three weeks, a deload to finish. Plans store the
weaknesses they were built from, so an old plan stays readable after the logbook
moves on. Session blocks use the same `{exercise, detail, sets}` shape as logged
sessions, so a planned session can be logged as-is.

The engines are pure and independently unit-tested; the AI coach reads the same
weaknesses through a `get_weaknesses` tool, so chat and plan agree.

```bash
cd backend && .venv/bin/pytest tests/test_weaknesses.py tests/test_plan.py
```

## Configuration

Backend reads `.env` (see `backend/.env.example`): `DATABASE_URL`, `JWT_SECRET`.
Uploaded videos and climb photos share a pluggable store — local disk under
`media/` in dev (`STORAGE_BACKEND`, `MEDIA_ROOT`, `MAX_UPLOAD_MB`,
`MAX_IMAGE_MB`), S3-shaped for later.
The coach reads `ANTHROPIC_API_KEY`, plus optional `COACH_MODEL`,
`COACH_EFFORT`, `COACH_MAX_TOKENS`, `COACH_MAX_TOOL_ROUNDS`, and
`COACH_HISTORY_LIMIT`.
Frontend reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).
