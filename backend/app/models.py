from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))
    # Profile
    climbing_style: Mapped[str | None] = mapped_column(String(50))  # boulder / sport / trad / all
    home_gym: Mapped[str | None] = mapped_column(String(120))
    grade_range_boulder: Mapped[str | None] = mapped_column(String(20))  # e.g. "V3-V5"
    grade_range_route: Mapped[str | None] = mapped_column(String(20))  # e.g. "5.10c-5.11b"
    goals: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    climbs: Mapped[list["Climb"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["TrainingSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    videos: Mapped[list["Video"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    plans: Mapped[list["TrainingPlan"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Climb(Base):
    """A logged climb/boulder: one row per problem or route the user worked."""

    __tablename__ = "climbs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    grade: Mapped[str] = mapped_column(String(10))  # "V4" or "5.11a"
    grade_system: Mapped[str] = mapped_column(String(10), default="v_scale")  # v_scale / yds
    climb_type: Mapped[str] = mapped_column(String(10), default="boulder")  # boulder / sport / trad
    wall_angle: Mapped[str | None] = mapped_column(String(10))  # slab / vertical / overhang / roof
    location: Mapped[str | None] = mapped_column(String(120))
    send_type: Mapped[str] = mapped_column(String(10), default="project")  # flash / onsight / redpoint / repeat / project
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str | None] = mapped_column(Text)
    climbed_on: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="climbs")
    attempts: Mapped[list["Attempt"]] = relationship(
        back_populates="climb", cascade="all, delete-orphan"
    )


class Attempt(Base):
    """An individual attempt on a climb. Will link to uploaded videos in phase 2."""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    climb_id: Mapped[int] = mapped_column(
        ForeignKey("climbs.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    attempt_date: Mapped[date] = mapped_column(Date)
    outcome: Mapped[str] = mapped_column(String(10))  # send / fall / progress
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    climb: Mapped[Climb] = relationship(back_populates="attempts")


class TrainingSession(Base):
    """A training session: gym/board/outdoor day with duration, RPE, and workout details."""

    __tablename__ = "training_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    session_date: Mapped[date] = mapped_column(Date)
    session_type: Mapped[str] = mapped_column(String(20))  # gym / board / outdoor / hangboard / other
    duration_minutes: Mapped[int] = mapped_column(Integer)
    rpe: Mapped[int | None] = mapped_column(Integer)  # 1-10 rate of perceived exertion
    notes: Mapped[str | None] = mapped_column(Text)
    # Structured workout data, e.g. [{"exercise": "hangboard", "detail": "20mm 7/3 repeaters", "sets": 6}]
    workout_details: Mapped[list | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="sessions")


class Video(Base):
    """An uploaded climbing attempt video, optionally attached to a logged climb.

    Files live in object storage (local disk in dev, S3-compatible in prod);
    this row only holds the storage key and probed metadata. Pose analysis runs
    asynchronously after upload and its result is a separate PoseAnalysis row.
    """

    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Optional link to the climb this attempt was on.
    climb_id: Mapped[int | None] = mapped_column(
        ForeignKey("climbs.id", ondelete="SET NULL"), index=True
    )
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(60))
    size_bytes: Mapped[int] = mapped_column(Integer)
    # Probed after upload; null until the analyzer reads the file.
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    fps: Mapped[float | None] = mapped_column(Float)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    # uploaded -> processing -> analyzed | failed
    status: Mapped[str] = mapped_column(String(12), default="uploaded", index=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="videos")
    analysis: Mapped["PoseAnalysis | None"] = relationship(
        back_populates="video", cascade="all, delete-orphan", uselist=False
    )


class PoseAnalysis(Base):
    """Result of running MediaPipe Pose + biomechanics heuristics over a video.

    - keypoints: a downsampled per-frame landmark track (list of frames, each a
      dict of joint -> [x, y, visibility] in normalized image coords).
    - metrics: computed scalar metrics (hip position, COG travel, foot control,
      body tension), each with a value and 0-100 score.
    - feedback: ordered, human-readable coaching notes derived from the metrics.
    """

    __tablename__ = "pose_analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    video_id: Mapped[int] = mapped_column(
        ForeignKey("videos.id", ondelete="CASCADE"), unique=True, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    frame_count: Mapped[int] = mapped_column(Integer)
    analyzed_fps: Mapped[float] = mapped_column(Float)
    # Overall movement-quality score, 0-100, averaged across metrics.
    overall_score: Mapped[int] = mapped_column(Integer)
    keypoints: Mapped[list | None] = mapped_column(JSON)
    metrics: Mapped[dict] = mapped_column(JSON)
    feedback: Mapped[list] = mapped_column(JSON)
    # "mediapipe" for a real analyzed video, "synthetic" for generated dev data.
    source: Mapped[str] = mapped_column(String(12), default="mediapipe")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    video: Mapped[Video] = relationship(back_populates="analysis")


class Conversation(Base):
    """A coach chat thread. Holds the transcript the AI coach is replying within."""

    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Auto-derived from the first user message; editable later.
    title: Mapped[str] = mapped_column(String(120), default="New conversation")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Bumped on every new message so the sidebar can sort by recency.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list["CoachMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="CoachMessage.id",
    )


class CoachMessage(Base):
    """One turn in a coach conversation.

    Only the final rendered text is persisted — intermediate tool_use blocks are
    resolved within a single turn and never replayed, so the transcript we send
    back to the model on later turns is plain role/content pairs. `tool_calls`
    keeps the names + inputs of whatever the coach looked up, purely so the UI
    can show what it consulted.
    """

    __tablename__ = "coach_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(10))  # user / assistant
    content: Mapped[str] = mapped_column(Text)
    # e.g. [{"name": "get_recent_climbs", "input": {"days": 30}}]
    tool_calls: Mapped[list | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class TrainingPlan(Base):
    """A generated training block, frozen at the moment it was created.

    The plan body and the weaknesses it was built from are both stored, so an
    old plan stays interpretable after the logbook has moved on — regenerating
    from today's data would silently rewrite the reasoning behind it.
    """

    __tablename__ = "training_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(120))
    weeks: Mapped[int] = mapped_column(Integer)
    days_per_week: Mapped[int] = mapped_column(Integer)
    summary: Mapped[str] = mapped_column(Text)
    focus_areas: Mapped[list] = mapped_column(JSON)
    cautions: Mapped[list] = mapped_column(JSON)
    # [{week, day, title, session_type, focus, blocks: [...], notes}]
    sessions: Mapped[list] = mapped_column(JSON)
    # The ranked weaknesses this plan was generated from.
    weaknesses: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="plans")
