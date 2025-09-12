// src/pages/SessionRecorder.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { saveSessionSummary } from "../utils/sessionStorage";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

type FrameRecord = {
  t: number; // ms since start
  landmarks: any[]; // pose landmarks array
};

export default function SessionRecorder() {
  const params = useParams<{ mode: string; exercise: string }>();
  const navigate = useNavigate();
  const mode = params.mode || "exercise";
  const exercise = params.exercise || "squat";

  const videoDemoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null); // hidden video input for pose
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

  useEffect(() => {
    // init pose
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (results.image) ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        try {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
          drawLandmarks(ctx, results.poseLandmarks, { color: "#FF0000", lineWidth: 1 });
        } catch (e) {}
        // record landmarks with timestamp (ms since start)
        if (recording && startTs) {
          const now = performance.now();
          const rec: FrameRecord = {
            t: now - startTs,
            landmarks: results.poseLandmarks,
          };
          framesRef.current.push(rec);
        }
      }
    });

    return () => {
      try { (poseRef.current as any)?.close?.(); } catch {}
      poseRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, startTs]);

  // start camera input (hidden video feed) and set canvas size based on it
  async function startCamera() {
    setStatus("Requesting camera...");
    if (!videoRef.current || !canvasRef.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      videoRef.current.srcObject = s;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      await videoRef.current.play();

      // ensure canvas matches video
      canvasRef.current.width = videoRef.current.videoWidth || 640;
      canvasRef.current.height = videoRef.current.videoHeight || 480;

      // start mediapipe Camera helper that will call pose.send
      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current && videoRef.current) await poseRef.current.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480,
      });
      cameraRef.current.start();
      setStatus("Camera ready");
    } catch (err) {
      console.error("Camera error", err);
      setStatus("Camera permission denied or error");
    }
  }

  useEffect(() => {
    // auto-start camera when page loads
    startCamera();
    return () => {
      try { cameraRef.current?.stop(); } catch {}
      cameraRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // start recording: record canvas stream + start collecting frames
  function startRecording() {
    if (!canvasRef.current) return;
    framesRef.current = [];
    setFrames([]);
    setStatus("Recording...");
    setRecording(true);
    const start = performance.now();
    setStartTs(start);

    // capture canvas stream
    const stream = (canvasRef.current as HTMLCanvasElement).captureStream(30);
    let options = { mimeType: "video/webm;codecs=vp9" } as any;
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm;codecs=vp8" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm" };
      }
    }
    const mr = new MediaRecorder(stream, options);
    chunksRef.current = [];
    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunksRef.current.push(ev.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setDownloadVideoUrl(url);

      // assemble session JSON (full frames can be large — we only offer download)
      const session = {
        id: uid(),
        mode,
        exercise,
        startTs,
        endTs: performance.now(),
        durationMs: Math.round(performance.now() - (startTs || performance.now())),
        frames: framesRef.current, // this can be huge; use carefully
      };
      const jsonBlob = new Blob([JSON.stringify(session)], { type: "application/json" });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      setDownloadJsonUrl(jsonUrl);

      // Save a light session summary to localStorage (no frames)
      saveSessionSummary({
        id: session.id,
        mode: session.mode,
        exercise: session.exercise,
        startTs: session.startTs,
        endTs: session.endTs,
        durationMs: session.durationMs,
        reps: 0,
        notes: "Recorded locally",
        videoUrl: url,
        meta: {},
      });
      setStatus("Recording saved locally (download links ready)");
      setRecording(false);
      // update UI frames state (light preview)
      setFrames(framesRef.current.slice(0, 500)); // show first N records
    };
    mr.start();
    recorderRef.current = mr;
  }

  // stop recording
  function stopRecording() {
    setStatus("Stopping...");
    try {
      recorderRef.current?.stop();
    } catch (e) {
      console.warn("recorder stop error", e);
      setStatus("Stopped with error");
      setRecording(false);
    }
  }

  // download helpers
  function download(url: string | null, filename: string) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="p-6">
      <Link to="/library/exercise" className="text-blue-600 mb-4 inline-block">← Back</Link>
      <h1 className="text-2xl font-bold mb-2">Session: {exercise} ({mode})</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="font-semibold mb-2">Demo</h2>
          <video ref={videoDemoRef} src={`/videos/${mode}/${exercise}_demo.mp4`} controls className="w-full rounded shadow" />
        </div>

        <div>
          <h2 className="font-semibold mb-2">Your camera</h2>
          <div className="relative bg-black rounded overflow-hidden">
            {/* hidden video input */}
            <video ref={videoRef} className="hidden" playsInline />
            <canvas ref={canvasRef} className="rounded-lg shadow" style={{ width: 640, height: 480 }} />
          </div>
          <div className="mt-3 flex gap-2">
            {!recording ? (
              <button onClick={startRecording} className="px-3 py-2 bg-green-600 text-white rounded">Start Recording</button>
            ) : (
              <button onClick={stopRecording} className="px-3 py-2 bg-red-600 text-white rounded">Stop Recording</button>
            )}
            <button onClick={() => {
              try { cameraRef.current?.stop(); } catch {}
              startCamera();
            }} className="px-3 py-2 bg-gray-200 rounded">Restart Camera</button>
            <button onClick={() => {
              if (downloadVideoUrl) download(downloadVideoUrl, `${exercise}_session.webm`);
              if (downloadJsonUrl) download(downloadJsonUrl, `${exercise}_landmarks.json`);
            }} className="px-3 py-2 bg-blue-600 text-white rounded">Download Last Files</button>
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
