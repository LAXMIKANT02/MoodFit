// src/pages/SessionRecorder.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { saveSessionSummary } from "../utils/sessionStorage";
import MusicPlayer, { MusicPlayerHandle } from "../components/MusicPlayer";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

type FrameRecord = { t: number; landmarks: any[] };

/**
 * DEMO_MAP:
 * - Preferred: full YouTube URLs (or "https://www.youtube.com/watch?v=VIDEO_ID")
 * - Fallback: local files you put under public/videos/<mode>/<exercise>_demo.mp4
 *
 * Replace the VIDEO_ID placeholders below with real YouTube IDs (or full URLs)
 * Or leave blank and add local files in public/videos/...
 */
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
    // high-quality yoga demo links (YouTube)
    tree: "https://www.youtube.com/watch?v=yVE4XXFFO70",       // Tree Pose - Yoga With Adriene
    warrior2: "https://www.youtube.com/watch?v=4Ejz7IgODlU",   // Warrior II - Yoga With Adriene
    downward_dog: "https://www.youtube.com/watch?v=j97SSGsnCAQ",// Downward Dog - Yoga With Adriene
    child_pose: "https://www.youtube.com/watch?v=eqVMAPM00DM", // Child's Pose - Yoga With Adriene (Extended)
    cobra: "https://www.youtube.com/watch?v=jwoTJNgh8BY",      // Cobra Pose tutorial
    bridge: "https://www.youtube.com/watch?v=NnbvPeAIhmA",     // Bridge Pose - Yoga With Adriene
    seated_forward_fold: "https://www.youtube.com/watch?v=3qHXmRDN-ig", // Seated Forward Fold / Basics
  },
};

export default function SessionRecorder() {
  const params = useParams<{ mode: string; exercise: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mode = params.mode || "exercise";
  const exercise = params.exercise || "squat";

  // demoUrl resolution:
  // 1) If DEMO_MAP contains a valid string -> use that (expect YouTube/full URL)
  // 2) Else fallback to local file path: /videos/<mode>/<exercise>_demo.mp4
  const demoCandidate = DEMO_MAP[mode] && DEMO_MAP[mode][exercise];
  const demoUrl = typeof demoCandidate === "string" && demoCandidate.length > 0
    ? demoCandidate
    : `/videos/${mode}/${exercise}_demo.mp4`;

  const isRemoteDemo = typeof demoUrl === "string" && demoUrl.startsWith("http");

  // reading ?music=true
  const musicEnabled = searchParams.get("music") === "true";

  const videoDemoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [frames, setFrames] = useState<FrameRecord[]>([]);
  const framesRef = useRef<FrameRecord[]>([]);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [status, setStatus] = useState("Ready");
  const [downloadVideoUrl, setDownloadVideoUrl] = useState<string | null>(null);
  const [downloadJsonUrl, setDownloadJsonUrl] = useState<string | null>(null);

  // canvas size state to mirror demo
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });

  // demo load failure state (if local file missing or remote blocked)
  const [demoFailed, setDemoFailed] = useState(false);
  // reset demoFailed when demoUrl changes
  useEffect(() => setDemoFailed(false), [demoUrl]);

  // music player ref + playlist defaults (local paths)
  const musicRef = useRef<MusicPlayerHandle | null>(null);
  const exercisePlaylist = [
    `/music/exercise/track1.mp3`,
    `/music/exercise/track2.mp3`,
  ];
  const yogaPlaylist = [
    `/music/yoga/track1.mp3`,
    `/music/yoga/track2.mp3`,
  ];
  const playlist = mode === "yoga" ? yogaPlaylist : exercisePlaylist;

  // update canvas size from actual video
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

  useEffect(() => {
    if (!poseRef.current) {
      poseRef.current = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
    }
    const pose = poseRef.current;
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

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
        } catch (e) {}
        if (recording && startTs) {
          const now = performance.now();
          framesRef.current.push({ t: now - startTs, landmarks: results.poseLandmarks });
        }
      }
    });

    return () => {
      try { (poseRef.current as any)?.close?.(); } catch {}
      poseRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, startTs]);

  async function startCamera() {
    setStatus("Requesting camera...");
    if (!videoRef.current || !canvasRef.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      videoRef.current.srcObject = s;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      await videoRef.current.play();

      updateCanvasSizeFromVideo();

      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current && videoRef.current) await poseRef.current.send({ image: videoRef.current! });
        },
        width: canvasSize.width,
        height: canvasSize.height,
      });
      cameraRef.current.start();
      setStatus("Camera ready");
    } catch (err) {
      console.error("Camera error", err);
      setStatus("Camera permission denied or error");
    }
  }

  useEffect(() => {
    // auto-start camera on mount
    startCamera();
    return () => {
      try { cameraRef.current?.stop(); } catch {}
      cameraRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startRecording() {
    if (!canvasRef.current) return;
    framesRef.current = [];
    setFrames([]);
    setStatus("Recording...");
    setRecording(true);
    const start = performance.now();
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

      const session = {
        id: uid(),
        mode, exercise, startTs,
        endTs: performance.now(),
        durationMs: Math.round(performance.now() - (startTs || performance.now())),
        frames: framesRef.current,
      };

      const jsonBlob = new Blob([JSON.stringify(session)], { type: "application/json" });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      setDownloadJsonUrl(jsonUrl);

      saveSessionSummary({
        id: session.id,
        mode: session.mode,
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
      setFrames(framesRef.current.slice(0, 500));
    };

    mr.start();
    recorderRef.current = mr;
    // if music is enabled and player exists, we do not auto-play but we can attempt to start it:
    if (musicEnabled && musicRef.current && !musicRef.current.isPlaying()) {
      // try to start music (may be blocked by autoplay policies)
      musicRef.current.play();
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

  // convert youtube watch/short url to embed
  function getEmbedSrc(u: string) {
    if (!u) return "";
    if (u.includes("youtube.com/watch")) return u.replace("watch?v=", "embed/");
    if (u.includes("youtu.be/")) return u.replace("youtu.be/", "www.youtube.com/embed/");
    return u;
  }

  // show placeholder when demo missing or video failed to load
  const renderDemoArea = () => {
    if (isRemoteDemo) {
      // show remote iframe; if user provided a placeholder "VIDEO_ID" it will still render iframe (YouTube will show error)
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

    // local-file path case: try to render <video> but gracefully detect onError
    return demoFailed ? (
      <div className="w-full h-full flex items-center justify-center text-center p-6">
        <div>
          <div className="mb-2 text-lg font-semibold text-white">No demo available</div>
          <div className="text-sm text-gray-200">Add a demo video at <code>/public/videos/{mode}/{exercise}_demo.mp4</code> or set a YouTube URL in the DEMO_MAP.</div>
        </div>
      </div>
    ) : (
      <video
        ref={videoDemoRef}
        src={demoUrl}
        controls
        className="w-full h-full object-cover"
        style={{ width: canvasSize.width, height: canvasSize.height, maxWidth: "100%" }}
        onError={() => {
          // local file missing or failed to load — show friendly placeholder
          setDemoFailed(true);
        }}
      />
    );
  };

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
            <button onClick={() => { try { cameraRef.current?.stop(); } catch {} startCamera(); }} className="px-3 py-2 bg-gray-200 rounded">Restart Camera</button>
            <button onClick={() => { if (downloadVideoUrl) download(downloadVideoUrl, `${exercise}_session.webm`); if (downloadJsonUrl) download(downloadJsonUrl, `${exercise}_landmarks.json`); }} className="px-3 py-2 bg-blue-600 text-white rounded">Download Last Files</button>
            <button onClick={() => { setFrames([]); setDownloadJsonUrl(null); setDownloadVideoUrl(null); }} className="px-3 py-2 bg-yellow-400 rounded">Clear</button>
          </div>

          <div className="mt-2 text-sm text-gray-600">Status: {status}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold">Session preview (first frames)</h3>
        <div className="max-h-48 overflow-auto bg-white p-3 rounded shadow">
          <pre className="text-xs">{JSON.stringify(frames.slice(0, 40).map(f => ({ t: Math.round(f.t), l0: (f.landmarks && f.landmarks[0] ? {x: f.landmarks[0].x, y: f.landmarks[0].y} : null) })), null, 2)}</pre>
        </div>
        <div className="mt-3">
          <button onClick={() => navigate("/sessions")} className="text-sm text-blue-600">Open Sessions Library</button>
        </div>
      </div>
    </div>
  );
}
