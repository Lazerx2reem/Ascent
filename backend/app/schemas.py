from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------- Auth / users ----------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    display_name: str
    climbing_style: str | None = None
    home_gym: str | None = None
    grade_range_boulder: str | None = None
    grade_range_route: str | None = None
    goals: str | None = None
    created_at: datetime


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    climbing_style: str | None = None
    home_gym: str | None = None
    grade_range_boulder: str | None = None
    grade_range_route: str | None = None
    goals: str | None = None


# ---------- Climbs ----------


class ClimbBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=10)
    grade_system: str = Field(default="v_scale", pattern="^(v_scale|yds)$")
    climb_type: str = Field(default="boulder", pattern="^(boulder|sport|trad)$")
    wall_angle: str | None = Field(default=None, pattern="^(slab|vertical|overhang|roof)$")
    location: str | None = Field(default=None, max_length=120)
    send_type: str = Field(
        default="project", pattern="^(flash|onsight|redpoint|repeat|project)$"
    )
    attempt_count: int = Field(default=1, ge=1)
    notes: str | None = None
    climbed_on: date


class ClimbCreate(ClimbBase):
    pass


class ClimbUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    grade: str | None = Field(default=None, min_length=1, max_length=10)
    grade_system: str | None = Field(default=None, pattern="^(v_scale|yds)$")
    climb_type: str | None = Field(default=None, pattern="^(boulder|sport|trad)$")
    wall_angle: str | None = Field(default=None, pattern="^(slab|vertical|overhang|roof)$")
    location: str | None = Field(default=None, max_length=120)
    send_type: str | None = Field(
        default=None, pattern="^(flash|onsight|redpoint|repeat|project)$"
    )
    attempt_count: int | None = Field(default=None, ge=1)
    notes: str | None = None
    climbed_on: date | None = None


class ClimbOut(ClimbBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ---------- Attempts ----------


class AttemptCreate(BaseModel):
    attempt_date: date
    outcome: str = Field(pattern="^(send|fall|progress)$")
    notes: str | None = None


class AttemptOut(AttemptCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    climb_id: int


# ---------- Training sessions ----------


class WorkoutItem(BaseModel):
    exercise: str = Field(min_length=1, max_length=40)  # hangboard / campus / core / other
    detail: str = Field(default="", max_length=200)  # e.g. "20mm 7/3 repeaters"
    sets: int = Field(default=1, ge=1)


class SessionBase(BaseModel):
    session_date: date
    session_type: str = Field(pattern="^(gym|board|outdoor|hangboard|other)$")
    duration_minutes: int = Field(ge=1)
    rpe: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None
    workout_details: list[WorkoutItem] | None = None


class SessionCreate(SessionBase):
    pass


class SessionOut(SessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ---------- Stats ----------


class PyramidEntry(BaseModel):
    grade: str
    count: int


class ProgressPoint(BaseModel):
    month: str  # "2026-07"
    sends: int


class AngleEntry(BaseModel):
    wall_angle: str
    count: int


class StatsSummary(BaseModel):
    total_climbs: int
    total_sends: int
    total_sessions: int
    total_hours: float
    hardest_boulder: str | None
    hardest_route: str | None


# ---------- Videos & pose analysis ----------


class PoseMetricOut(BaseModel):
    key: str
    label: str
    value: float
    unit: str
    score: int
    summary: str


class PoseFeedbackOut(BaseModel):
    category: str
    severity: str  # good / warn / poor
    title: str
    message: str
    score: int


class PoseAnalysisSummary(BaseModel):
    """Lightweight analysis view for list rows."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    overall_score: int
    source: str


class PoseAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    overall_score: int
    frame_count: int
    analyzed_fps: float
    source: str
    metrics: dict[str, PoseMetricOut]
    feedback: list[PoseFeedbackOut]
    created_at: datetime


class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    climb_id: int | None
    status: str  # uploaded / processing / analyzed / failed
    error_message: str | None
    size_bytes: int
    duration_seconds: float | None
    fps: float | None
    width: int | None
    height: int | None
    created_at: datetime
    analysis: PoseAnalysisSummary | None = None


class VideoDetailOut(VideoOut):
    # Overrides the summary with the full analysis payload.
    analysis: PoseAnalysisOut | None = None


# ---------- AI coach ----------


class CoachToolCall(BaseModel):
    name: str
    input: dict = Field(default_factory=dict)


class CoachMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str  # user / assistant
    content: str
    tool_calls: list[CoachToolCall] | None = None
    created_at: datetime


class ConversationOut(BaseModel):
    """List row — no transcript."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationDetailOut(ConversationOut):
    messages: list[CoachMessageOut] = Field(default_factory=list)


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=120)


class CoachMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


# ---------- Weakness detection & training plans ----------


class WeaknessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    focus: str
    score: int  # 0-100, lower = weaker
    severity: str  # high / moderate / low
    summary: str
    evidence: list[str]
    advice: str


class WeaknessReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weaknesses: list[WeaknessOut]
    data_gaps: list[str]


class PlanBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exercise: str
    detail: str
    sets: int


class PlannedSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    week: int
    day: int
    title: str
    session_type: str
    focus: str
    blocks: list[PlanBlockOut]
    notes: str


class TrainingPlanOut(BaseModel):
    """List row — no session detail."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    weeks: int
    days_per_week: int
    summary: str
    focus_areas: list[str]
    created_at: datetime


class TrainingPlanDetailOut(TrainingPlanOut):
    cautions: list[str]
    sessions: list[PlannedSessionOut]
    weaknesses: list[WeaknessOut]


class TrainingPlanCreate(BaseModel):
    weeks: int = Field(default=4, ge=1, le=12)
    days_per_week: int = Field(default=3, ge=1, le=6)
    title: str | None = Field(default=None, max_length=120)
