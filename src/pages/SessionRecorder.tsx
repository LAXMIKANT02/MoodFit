// src/pages/SessionRecorder.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { saveSessionSummary, saveFullSession, FullSession } from "../utils/sessionStorage";
import MusicPlayer, { MusicPlayerHandle } from "../components/MusicPlayer";

// Optional helper to upload session JSON (and store in Supabase Storage + DB).
// If you don't have this file yet, create it as discussed earlier. Importing is safe:
// we call it inside a try/catch so nothing breaks if it's missing or throws.
//import { uploadSessionToSupabase } from "../lib/sessionStorageSupabase"; // <-- optional; ensure this path exists if you want uploads

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

type FrameRecord = { t: number; landmarks: any[] };

const MAX_IN_MEMORY_FRAMES = 2000;
const SAVE_DOWNSAMPLE_FACTOR = 1;

const DEMO_MAP: Record<string, Record<string, string | undefined>> = {
  exercise: {
    squat: "https://www.youtube.com/watch?v=aclHkVaku9U",
    pushup: "https://www.youtube.com/watch?v=_l3ySVKYVJ8",
    lunge: "https://www.youtube.com/watch?v=QOVaHwm-Q6U",
    plank: "https://www.youtube.com/watch?v=pSHjTRCQxIw",
    jumping_jack: "https://www.youtube.com/watch?v=c4DAnQ6DtF8",
    situp: "https://www.youtube.com/watch?v=1fbU_MkV7NE",
    deadlift: "https://www.youtube.com/watch?v=op9kVnSso6Q",
  },
  yoga: {
    tree: "https://www.youtube.com/watch?v=yVE4XXFFO70",
    warrior2: "https://www.youtube.com/watch?v=4Ejz7IgODlU",
    downward_dog: "https://www.youtube.com/watch?v=j97SSGsnCAQ",
    child_pose: "https://www.youtube.com/watch?v=eqVMAPM00DM",
    cobra: "https://www.youtube.com/watch?v=jwoTJNgh8BY",
    bridge: "https://www.youtube.com/watch?v=NnbvPeAIhmA",
    seated_forward_fold: "https://www.youtube.com/watch?v=3qHXmRDN-ig",
  },
};

export default function SessionRecorder() {
  const params = useParams<{ mode: string; exercise: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mode = params.mode || "exercise";
  const exercise = params.exercise || "squat";

  const demoCandidate = DEMO_MAP[mode] && DEMO_MAP[mode][exercise];
  const demoUrl = typeof demoCandidate === "string" && demoCandidate.length > 0
    ? demoCandidate
    : `/videos/${mode}/${exercise}_demo.mp4`;
  const isRemoteDemo = typeof demoUrl === "string" && demoUrl.startsWith("http");

  const musicEnabled = searchParams.get("music") === "true";

  const videoDemoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const framesRef = useRef<FrameRecord[]>([]);
  const framesFullRef = useRef<FrameRecord[]>([]);

  const [recording, setRecording] = useState(false);
  const [framesPreview, setFramesPreview] = useState<FrameRecord[]>([]);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [status, setStatus] = useState("Ready");
  const [downloadVideoUrl, setDownloadVideoUrl] = useState<string | null>(null);
  const [downloadJsonUrl, setDownloadJsonUrl] = useState<string | null>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });
  const [demoFailed, setDemoFailed] = useState(false);
  useEffect(() => setDemoFailed(false), [demoUrl]);

  const musicRef = useRef<MusicPlayerHandle | null>(null);
  const exercisePlaylist = [`/music/exercise/track1.mp3`, `/music/exercise/track2.mp3`];
  const yogaPlaylist = [`/music/yoga/track1.mp3`, `/music/yoga/track2.mp3`];
  const playlist = mode === "yoga" ? yogaPlaylist : exercisePlaylist;

  function updateCanvasSizeFromVideo() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    c.width = w;
    c.height = h;
    setCanvasSize({ width: w, height: h });
  }

  async function stopCamera() {
    try {
      if (cameraRef.current) {
        try { cameraRef.current.stop(); } catch (_) {}
        cameraRef.current = null;
      }
    } catch (_) {}
    try {
      const v = videoRef.current;
      if (v && v.srcObject) {
        const s = v.srcObject as MediaStream;
        s.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
        try { v.srcObject = null; } catch (_) {}
      }
    } catch (_) {}
  }

  const isStartingCamera = useRef(false);
  async function startCamera() {
    if (isStartingCamera.current) return;
    isStartingCamera.current = true;
    setStatus("Requesting camera...");
    if (!videoRef.current || !canvasRef.current) { isStartingCamera.current = false; return; }
    try {
      await stopCamera();
      await new Promise(res => setTimeout(res, 50));
      const constraints = { video: { width: 640, height: 480 }, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!videoRef.current) { stream.getTracks().forEach(t => { try { t.stop(); } catch (_) {} }); isStartingCamera.current = false; return; }
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      try { await videoRef.current.play(); } catch (err) { /* play interrupted sometimes - proceed */ }
      updateCanvasSizeFromVideo();
      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => { if (poseRef.current && videoRef.current) await poseRef.current.send({ image: videoRef.current! }); },
        width: canvasSize.width,
        height: canvasSize.height,
      });
      cameraRef.current.start();
      setStatus("Camera ready");
    } catch (err) {
      console.error("Camera error", err);
      setStatus("Camera permission denied or error");
    } finally {
      isStartingCamera.current = false;
    }
  }

  useEffect(() => {
    if (!poseRef.current) {
      poseRef.current = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
    }
    const pose = poseRef.current;
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    pose.onResults((results: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      if (videoRef.current && (canvas.width !== (videoRef.current.videoWidth || canvas.width) || canvas.height !== (videoRef.current.videoHeight || canvas.height))) {
        updateCanvasSizeFromVideo();
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (results.image) ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        try {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
          drawLandmarks(ctx, results.poseLandmarks, { color: "#FF0000", lineWidth: 1 });
        } catch (_) {}
        if (recording && startTs) {
          const now = Date.now();
          const rec: FrameRecord = { t: now - startTs, landmarks: results.poseLandmarks };
          framesFullRef.current.push(rec);
          framesRef.current.push(rec);
          if (framesRef.current.length > MAX_IN_MEMORY_FRAMES) {
            framesRef.current.splice(0, framesRef.current.length - MAX_IN_MEMORY_FRAMES);
          }
        }
      }
    });

    return () => { try { (poseRef.current as any)?.close?.(); } catch (_) {} ; poseRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, startTs]);

  useEffect(() => { startCamera(); return () => { try { stopCamera(); } catch (_) {} }; }, []);

  function startRecording() {
    if (!canvasRef.current) return;
    framesRef.current = [];
    framesFullRef.current = [];
    setFramesPreview([]);
    setStatus("Recording...");
    setRecording(true);

    // key fix: use Date.now() for startTs (epoch ms)
    const start = Date.now();
    setStartTs(start);

    const stream = (canvasRef.current as HTMLCanvasElement).captureStream(30);
    let options = { mimeType: "video/webm;codecs=vp9" } as any;
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm;codecs=vp8" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: "video/webm" };
    }

    const mr = new MediaRecorder(stream, options);
    chunksRef.current = [];
    mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunksRef.current.push(ev.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setDownloadVideoUrl(url);

      const fullFrames = framesFullRef.current || [];
      let framesToSave = fullFrames;
      if (SAVE_DOWNSAMPLE_FACTOR > 1 && fullFrames.length > 0) {
        framesToSave = fullFrames.filter((_, i) => i % SAVE_DOWNSAMPLE_FACTOR === 0);
      }

      const normalizedExercise = (exercise || "").toLowerCase().trim();
      const endTs = Date.now();
      const durationMs = Math.round(endTs - (start || endTs));

      const session: FullSession = {
        id: uid(),
        mode,
        exercise: normalizedExercise,
        startTs: start || Date.now(),
        endTs,
        durationMs,
        frames: framesToSave,
        meta: {},
      };

      // Save full session locally (unchanged logic)
      try { saveFullSession(session); } catch (err) { console.warn("saveFullSession failed", err); }

      const jsonBlob = new Blob([JSON.stringify(session)], { type: "application/json" });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      setDownloadJsonUrl(jsonUrl);

      saveSessionSummary({
        id: session.id,
        mode: session.mode as "exercise" | "yoga",
        exercise: session.exercise,
        startTs: session.startTs,
        endTs: session.endTs,
        durationMs: session.durationMs,
        reps: 0,
        notes: musicEnabled ? "Recorded with music" : "Recorded without music",
        videoUrl: url,
        meta: {},
      });

      setStatus("Recording saved locally (download ready)");
      setRecording(false);
      setFramesPreview(framesRef.current.slice(0, 500));
      console.debug("[recorder] saved session", session.id, "framesSaved:", session.frames.length);

      // --- Optional: upload to Supabase (non-blocking, safe) ---
      // If you want to upload sessions to Supabase Storage + DB, implement uploadSessionToSupabase(session, opts)
      // in src/lib/sessionStorageSupabase.ts and export it. If it's missing, the call below will fail gracefully.
      (async () => {
        try {
          // indicate upload started
          setStatus("Uploading session to server...");
          if (typeof uploadSessionToSupabase === "function") {
            // compress option assumed by helper; adapt as needed
            const res = await uploadSessionToSupabase(session, { compress: true });
            // res should describe DB rows + storage path; show brief confirmation
            console.info("[recorder] uploaded session to Supabase:", res);
            setStatus("Uploaded session to server");
          } else {
            // helper not available — skip silently but set status
            console.warn("[recorder] uploadSessionToSupabase function missing; skipping upload.");
            setStatus("Saved locally (server upload skipped)");
          }
        } catch (err) {
          console.error("[recorder] upload to Supabase failed:", err);
          setStatus("Saved locally (upload failed)");
        } finally {
          // leave user with final saved state visible
          setTimeout(() => {
            if (!recording) setStatus("Ready");
          }, 800);
        }
      })();
    };

    mr.start();
    recorderRef.current = mr;

    if (musicEnabled && musicRef.current && !musicRef.current.isPlaying()) {
      try { musicRef.current.play(); } catch (_) {}
    }
  }

  function stopRecording() {
    setStatus("Stopping...");
    try { recorderRef.current?.stop(); } catch (e) { console.warn(e); setRecording(false); setStatus("Stopped with error"); }
  }

  function download(url: string | null, filename: string) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function getEmbedSrc(u: string) {
    if (!u) return "";
    if (u.includes("youtube.com/watch")) return u.replace("watch?v=", "embed/");
    if (u.includes("youtu.be/")) return u.replace("youtu.be/", "www.youtube.com/embed/");
    return u;
  }

  const renderDemoArea = () => {
    if (isRemoteDemo) {
      return (
        <iframe
          src={getEmbedSrc(demoUrl)}
          title={`${exercise} demo`}
          style={{ width: canvasSize.width, height: canvasSize.height, maxWidth: "100%" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    return demoFailed ? (
      <div className="w-full h-full flex items-center justify-center text-center p-6">
        <div>
          <div className="mb-2 text-lg font-semibold text-white">No demo available</div>
          <div className="text-sm text-gray-200">Add a demo video at <code>/public/videos/{mode}/{exercise}_demo.mp4</code> or set a YouTube URL in the DEMO_MAP.</div>
        </div>
      </div>
    ) : (
      <video ref={videoDemoRef} src={demoUrl} controls className="w-full h-full object-cover"
        style={{ width: canvasSize.width, height: canvasSize.height, maxWidth: "100%" }}
        onError={() => { setDemoFailed(true); }} />
    );
  };

  useEffect(() => {
    return () => {
      try {
        if (downloadVideoUrl) URL.revokeObjectURL(downloadVideoUrl);
        if (downloadJsonUrl) URL.revokeObjectURL(downloadJsonUrl);
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6">
      <Link to={`/library/${mode}`} className="text-blue-600 mb-4 inline-block">← Back</Link>
      <h1 className="text-2xl font-bold mb-2">Session: {exercise} ({mode})</h1>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <div>
          <h2 className="font-semibold mb-2">Demo</h2>
          <div className="bg-gray-900 rounded overflow-hidden flex items-center justify-center shadow" style={{ width: canvasSize.width, height: canvasSize.height, maxWidth: "100%" }}>
            {renderDemoArea()}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Your camera</h2>
          <div className="relative bg-black rounded overflow-hidden" style={{ width: canvasSize.width, height: canvasSize.height, maxWidth: "100%" }}>
            <video ref={videoRef} className="hidden" playsInline />
            <canvas ref={canvasRef} className="rounded-lg shadow" style={{ width: "100%", height: "100%" }} />
            <div className="absolute top-2 left-2 bg-black bg-opacity-40 text-white text-xs px-2 py-1 rounded">Frames (preview): {framesRef.current.length}</div>
          </div>

          {musicEnabled && (
            <div className="mt-3">
              <h3 className="font-medium mb-2">Music Player</h3>
              <MusicPlayer ref={musicRef} playlist={playlist} />
              <div className="text-xs text-gray-500 mt-1">Ensure you placed audio files under <code>/public/music/{mode}/</code> or customize playlist paths in SessionRecorder.</div>
            </div>
          )}

          <div className="mt-3 flex gap-2 flex-wrap">
            {!recording ? (
              <button onClick={startRecording} className="px-3 py-2 bg-green-600 text-white rounded">Start Recording</button>
            ) : (
              <button onClick={stopRecording} className="px-3 py-2 bg-red-600 text-white rounded">Stop Recording</button>
            )}
            <button onClick={async () => { try { await stopCamera(); } catch {} await startCamera(); }} className="px-3 py-2 bg-gray-200 rounded">Restart Camera</button>
            <button onClick={() => { if (downloadVideoUrl) download(downloadVideoUrl, `${exercise}_session.webm`); if (downloadJsonUrl) download(downloadJsonUrl, `${exercise}_landmarks.json`); }} className="px-3 py-2 bg-blue-600 text-white rounded">Download Last Files</button>
            <button onClick={() => { setFramesPreview([]); setDownloadJsonUrl(null); setDownloadVideoUrl(null); framesRef.current = []; framesFullRef.current = []; }} className="px-3 py-2 bg-yellow-400 rounded">Clear</button>
          </div>

          <div className="mt-2 text-sm text-gray-600">Status: {status}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold">Session preview (first frames)</h3>
        <div className="max-h-48 overflow-auto bg-white p-3 rounded shadow">
          <pre className="text-xs">{JSON.stringify(framesPreview.slice(0, 40).map(f => ({ t: Math.round(f.t), l0: (f.landmarks && f.landmarks[0] ? {x: f.landmarks[0].x, y: f.landmarks[0].y} : null) })), null, 2)}</pre>
        </div>
        <div className="mt-3">
          <button onClick={() => navigate("/sessions")} className="text-sm text-blue-600">Open Sessions Library</button>
        </div>
      </div>
    </div>
  );
}
