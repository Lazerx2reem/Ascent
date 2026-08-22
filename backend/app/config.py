from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://ascent:ascent@localhost:5432/ascent"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 7  # one week
    cors_origins: list[str] = ["http://localhost:3000"]

    # Video storage. "local" writes under media_root; "s3" is reserved for prod.
    storage_backend: str = "local"
    media_root: str = "media"  # relative to the backend working directory
    max_upload_mb: int = 200
    allowed_video_types: list[str] = [
        "video/mp4",
        "video/quicktime",  # .mov
        "video/webm",
        "video/x-matroska",  # .mkv
    ]

    # Climb photos. HEIC is deliberately absent: phones produce it, but no
    # browser renders it in an <img>, so accepting it would store files the
    # logbook could never show.
    max_image_mb: int = 10
    allowed_image_types: list[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    ]

    # AI coach (phase 3). Without a key the coach endpoints return 503 and the
    # rest of the app is unaffected.
    anthropic_api_key: str | None = None
    coach_model: str = "claude-opus-5"
    # Caps thinking + reply together; a coaching turn rarely needs more.
    coach_max_tokens: int = 8000
    # Interactive chat — "medium" keeps replies snappy. Raise to "high" for
    # deeper reasoning at the cost of latency.
    coach_effort: str = "medium"
    # Ceiling on tool round-trips per turn, so a loop can't run away.
    coach_max_tool_rounds: int = 6
    # Prior turns replayed to the model on each request.
    coach_history_limit: int = 30


settings = Settings()
