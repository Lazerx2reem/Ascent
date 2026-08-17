export interface UserProfile {
  id: number;
  email: string;
  display_name: string;
  climbing_style: string | null;
  home_gym: string | null;
  grade_range_boulder: string | null;
  grade_range_route: string | null;
  goals: string | null;
  created_at: string;
}

export type GradeSystem = "v_scale" | "yds";
export type ClimbType = "boulder" | "sport" | "trad";
export type WallAngle = "slab" | "vertical" | "overhang" | "roof";
export type SendType = "flash" | "onsight" | "redpoint" | "repeat" | "project";
export type SessionType = "gym" | "board" | "outdoor" | "hangboard" | "other";

export interface Climb {
  id: number;
  name: string;
  grade: string;
  grade_system: GradeSystem;
  climb_type: ClimbType;
  wall_angle: WallAngle | null;
  location: string | null;
  send_type: SendType;
  attempt_count: number;
  notes: string | null;
  climbed_on: string;
  created_at: string;
}

export type ClimbCreate = Omit<Climb, "id" | "created_at">;

export interface WorkoutItem {
  exercise: string;
  detail: string;
  sets: number;
}

export interface TrainingSession {
  id: number;
  session_date: string;
  session_type: SessionType;
  duration_minutes: number;
  rpe: number | null;
  notes: string | null;
  workout_details: WorkoutItem[] | null;
  created_at: string;
}

export type SessionCreate = Omit<TrainingSession, "id" | "created_at">;

export interface PyramidEntry {
  grade: string;
  count: number;
}

export interface ProgressPoint {
  month: string;
  sends: number;
}

export interface AngleEntry {
  wall_angle: WallAngle;
  count: number;
}

export interface StatsSummary {
  total_climbs: number;
  total_sends: number;
  total_sessions: number;
  total_hours: number;
  hardest_boulder: string | null;
  hardest_route: string | null;
}

// ---------- Videos & pose analysis ----------

export type VideoStatus = "uploaded" | "processing" | "analyzed" | "failed";
export type FeedbackSeverity = "good" | "warn" | "poor";

export interface PoseMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  score: number;
  summary: string;
}

export interface PoseFeedback {
  category: string;
  severity: FeedbackSeverity;
  title: string;
  message: string;
  score: number;
}

export interface PoseAnalysisSummary {
  id: number;
  overall_score: number;
  source: string;
}

export interface PoseAnalysis {
  id: number;
  overall_score: number;
  frame_count: number;
  analyzed_fps: number;
  source: string;
  metrics: Record<string, PoseMetric>;
  feedback: PoseFeedback[];
  created_at: string;
}

interface VideoBase {
  id: number;
  original_filename: string;
  climb_id: number | null;
  status: VideoStatus;
  error_message: string | null;
  size_bytes: number;
  duration_seconds: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface VideoSummary extends VideoBase {
  analysis: PoseAnalysisSummary | null;
}

export interface VideoDetail extends VideoBase {
  analysis: PoseAnalysis | null;
}

// ---------- AI coach ----------

export interface CoachToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface CoachMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  tool_calls: CoachToolCall[] | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: CoachMessage[];
}

export interface CoachStatus {
  available: boolean;
  model: string;
}

/** One frame of the coach reply stream. */
export type CoachStreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "done"; message_id: number }
  | { type: "error"; message: string };

// ---------- Weaknesses & training plans ----------

/** Priority of addressing a weakness — not a quality band. */
export type WeaknessSeverity = "high" | "moderate" | "low";

export interface Weakness {
  key: string;
  label: string;
  focus: string;
  /** 0-100, lower means weaker. */
  score: number;
  severity: WeaknessSeverity;
  summary: string;
  evidence: string[];
  advice: string;
}

export interface WeaknessReport {
  weaknesses: Weakness[];
  /** Things the athlete isn't logging that would unlock more detectors. */
  data_gaps: string[];
}

export interface PlanBlock {
  exercise: string;
  detail: string;
  sets: number;
}

export interface PlannedSession {
  week: number;
  day: number;
  title: string;
  session_type: SessionType;
  focus: string;
  blocks: PlanBlock[];
  notes: string;
}

export interface TrainingPlanSummary {
  id: number;
  title: string;
  weeks: number;
  days_per_week: number;
  summary: string;
  focus_areas: string[];
  created_at: string;
}

export interface TrainingPlanDetail extends TrainingPlanSummary {
  cautions: string[];
  sessions: PlannedSession[];
  weaknesses: Weakness[];
}

export interface PlanRequest {
  weeks?: number;
  days_per_week?: number;
  title?: string;
}
