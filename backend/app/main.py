from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import auth, climbs, coach, sessions, stats, training, videos

app = FastAPI(title="Ascent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(climbs.router)
app.include_router(sessions.router)
app.include_router(stats.router)
app.include_router(videos.router)
app.include_router(coach.router)
app.include_router(training.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
