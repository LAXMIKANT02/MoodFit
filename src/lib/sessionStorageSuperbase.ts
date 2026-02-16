// src/lib/sessionStorageSupabase.ts
// Supabase helper: uploads full session JSON into Storage and inserts DB rows.
// Requires: @supabase/supabase-js and pako (optional for gzip).
// Env vars (Vite): VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import pako from "pako";

/* ---------- Init client from Vite env ---------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // don't throw during import to avoid breaking the app if envs missing,
  // but warn so dev knows to configure env.
  // eslint-disable-next-line no-console
  console.warn("[sessionStorageSupabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set");
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "");

/* ---------- Types ---------- */
export type FullSession = {
  id: string;
  mode: string; // "exercise" | "yoga" etc.
  exercise: string;
  startTs: number;
  endTs: number;
  durationMs: number;
  frames: Array<{ t: number; landmarks: any[] }>;
  meta?: Record<string, any>;
};

type UploadOpts = {
  compress?: boolean; // gzip (true) or plain JSON
  storageBucket?: string; // default 'sessions'
  storagePathPrefix?: string; // defaults to `${userId}/${sessionId}/`
};

/* ---------- Upload function ---------- */
export async function uploadSessionToSupabase(session: FullSession, opts: UploadOpts = {}) {
  if (!supabase) throw new Error("Supabase client not initialized");

  const compress = opts.compress ?? false;
  const bucket = opts.storageBucket ?? "sessions";

  // Get current authenticated user (v2 API)
  const userResp = await supabase.auth.getUser();
  const user = userResp?.data?.user ?? null;
  if (!user) {
    throw new Error("User not authenticated. Sign in before uploading session.");
  }
  const userId = user.id;

  // Prepare payload and file metadata
  const jsonStr = JSON.stringify(session);
  let blob: Blob;
  let ext = "json";
  let contentType = "application/json";

  if (compress) {
    const gz = pako.gzip(jsonStr);
    blob = new Blob([gz], { type: "application/gzip" });
    ext = "json.gz";
    contentType = "application/gzip";
  } else {
    blob = new Blob([jsonStr], { type: contentType });
  }

  const prefix = opts.storagePathPrefix ?? `${userId}/${session.id}`;
  const storagePath = `${prefix}/session.${ext}`;

  // Upload to storage
  const storage = supabase.storage.from(bucket);
  const up = await storage.upload(storagePath, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType,
  });

  if (up.error) {
    throw new Error(`Storage upload failed: ${up.error.message}`);
  }

  // Create a signed URL (optional)
  const signed = await storage.createSignedUrl(storagePath, 60 * 60); // 1 hour

  // Insert DB rows: full_sessions and session_summaries
  // Make sure your Supabase tables (and RLS) match these column names:
  // full_sessions: id, user_id, mode, exercise, storage_path, start_ts, end_ts, duration_ms, meta
  // session_summaries: id, user_id, mode, exercise, start_ts, end_ts, duration_ms, reps, notes, meta

  const fullInsert = await supabase
    .from("full_sessions")
    .insert([
      {
        id: session.id,
        user_id: userId,
        mode: session.mode,
        exercise: session.exercise,
        storage_path: storagePath,
        start_ts: new Date(session.startTs).toISOString(),
        end_ts: new Date(session.endTs).toISOString(),
        duration_ms: session.durationMs,
        meta: session.meta ?? {},
      },
    ])
    .select()
    .maybeSingle();

  if (fullInsert.error) {
    throw new Error("full_sessions insert failed: " + fullInsert.error.message);
  }

  const summaryInsert = await supabase
    .from("session_summaries")
    .insert([
      {
        id: session.id,
        user_id: userId,
        mode: session.mode,
        exercise: session.exercise,
        start_ts: new Date(session.startTs).toISOString(),
        end_ts: new Date(session.endTs).toISOString(),
        duration_ms: session.durationMs,
        reps: 0,
        notes: "Uploaded from client",
        meta: session.meta ?? {},
      },
    ])
    .select()
    .maybeSingle();

  if (summaryInsert.error) {
    throw new Error("session_summaries insert failed: " + summaryInsert.error.message);
  }

  return {
    storagePath,
    signedUrl: signed?.data?.signedUrl ?? null,
    storageResult: up,
    fullRow: fullInsert.data ?? null,
    summaryRow: summaryInsert.data ?? null,
  };
}
