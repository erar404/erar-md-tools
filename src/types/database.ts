export type JobType =
  | "download"
  | "analyze"
  | "trim"
  | "click_track"
  | "split"
  | "mixdown";

export type JobStatus = "pending" | "processing" | "done" | "error";

export type SourceType = "youtube" | "upload";

export type StemName = "vocals" | "drums" | "bass" | "other" | "piano";

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Track {
  id: string;
  user_id: string;
  title: string;
  source_type: SourceType;
  source_url: string | null;
  storage_path: string;
  duration_seconds: number | null;
  sample_rate: number | null;
  analyzed_key: string | null;
  analyzed_tempo: number | null;
  analyzed_time_signature: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  track_id: string | null;
  type: JobType;
  status: JobStatus;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackStem {
  id: string;
  track_id: string;
  job_id: string;
  stem_name: StemName;
  storage_path: string;
  created_at: string;
}

// `supabase gen types typescript` will generate the real `Database` type once
// the Supabase project exists (Phase 2); until then, clients are unparameterized
// and app code casts query results to the interfaces above.
