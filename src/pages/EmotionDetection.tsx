import React, { useEffect, useRef, useState } from "react";
// Import TFJS first and expose it to window so face-api uses the same runtime
import * as tf from "@tensorflow/tfjs";
(window as any).tf = tf;

// Use the maintained fork that is compatible with modern TFJS (v4+)
import * as faceapi from "@vladmandic/face-api";

// Try to pick a good backend early
(async () => {
  try {
    // prefer webgl, then wasm if available
    if (tf.findBackend && tf.findBackend("webgl")) {
      await tf.setBackend("webgl");
    } else if (tf.findBackend && tf.findBackend("wasm")) {
      await tf.setBackend("wasm");
    }
    await tf.ready();
    // eslint-disable-next-line no-console
    console.info("[Emotion] tf ready — backend:", tf.getBackend ? tf.getBackend() : "unknown");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Emotion] tf backend init error:", e);
  }
})();

/**
 * EmotionDetection.tsx
 * - Shows the VIDEO (visible) and hides the canvas (used only for background detection)
 * - Uses face-api.js models by default (MODEL_PATH)
 * - Displays detected emotion as emoji + label + confidence
 */

const MODEL_PATH = "https://justadudewhohacks.github.io/face-api.js/models";
const DETECT_INTERVAL_MS = 150; // ~6-7 FPS background detection

export default function EmotionDetection(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // hidden processing canvas
  const intervalRef = useRef<number | null>(null);

  const [running, setRunning] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState("Loading models...");
  const [dominant, setDominant] = useState<{ label: string; score: number } | null>(null);
  const [showDebugCanvas, setShowDebugCanvas] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Load models on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setStatus("Loading face-api models...");
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
        console.info("[Emotion] tinyFaceDetector loaded");
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_PATH);
        console.info("[Emotion] faceLandmark68TinyNet loaded");
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_PATH);
        console.info("[Emotion] faceExpressionNet loaded");

        if (!mounted) return;
        setModelsLoaded(true);
        setStatus("Models loaded. Click Start.");
        console.info("[Emotion] Models loaded");
      } catch (err) {
        console.error("[Emotion] Model load failed (detailed):", err);
        setLastError(String(err));
        setStatus("Model load failed. See console.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Start / stop camera & detection
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCameraAndDetection() {
      if (!modelsLoaded) {
        setStatus("Models are not loaded yet.");
        return;
      }
      setLastError(null);
      try {
        setStatus("Requesting camera permission...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (!videoRef.current) throw new Error("video element missing");

        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        // Wait until video metadata is ready to set canvas size and start detection.
        const onLoaded = async () => {
          try {
            // ensure hidden canvas size matches video
            const video = videoRef.current!;
            const canvas = canvasRef.current;
            if (canvas) {
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 480;
            }
            setStatus("Camera ready — running background detection");
            startBackgroundDetection();
          } catch (e) {
            console.warn("[Emotion] onLoaded handler error:", e);
          }
        };

        // use loadedmetadata which is more appropriate for width/height availability
        videoRef.current.addEventListener("loadedmetadata", onLoaded, { once: true });
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("[Emotion] video.play() blocked:", e);
        }
      } catch (err) {
        console.error("[Emotion] Camera start error:", err);
        setLastError(String(err));
        setStatus("Camera permission denied or unavailable.");
        setRunning(false);
      }
    }

    function stopCameraAndDetection() {
      // stop detection interval
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // stop and remove stream
      if (stream) {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
        stream = null;
      }
      // clear video src and pause
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {}
        try {
          // @ts-ignore
          videoRef.current.srcObject = null;
        } catch {}
      }
      setDominant(null);
      setStatus("Stopped");
    }

    if (running) startCameraAndDetection();
    else stopCameraAndDetection();

    return () => {
      stopCameraAndDetection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, modelsLoaded]);

  // Background detection loop (runs on hidden canvas)
  function startBackgroundDetection() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.warn("[Emotion] startBackgroundDetection: refs missing");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[Emotion] canvas 2D context missing");
      return;
    }

    // ensure canvas matches video size defensively
    canvas.width = video.videoWidth || canvas.width || 640;
    canvas.height = video.videoHeight || canvas.height || 480;

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

    // clear any existing interval
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = window.setInterval(async () => {
      if (!video || video.paused || video.ended) return;

      try {
        // perform detection on the video element
        const results = await faceapi
          .detectAllFaces(video, options)
          .withFaceLandmarks(true)
          .withFaceExpressions();

        // If debug canvas visible, draw simple overlays; else keep hidden.
        if (showDebugCanvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (!results || results.length === 0) {
          setDominant(null);
          if (showDebugCanvas) {
            // optionally show "no face" text
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillRect(0, 0, 160, 28);
            ctx.font = "14px Inter, Arial";
            ctx.fillStyle = "white";
            ctx.fillText("No face", 8, 18);
          }
          return;
        }

        // take the first detected face
        const r = results[0];
        const expressions = r.expressions || {};
        // pick dominant expression by score
        const entries = Object.entries(expressions) as [string, number][];
        entries.sort((a, b) => b[1] - a[1]);
        const [label, score] = entries[0];

        setDominant({ label, score });

        if (showDebugCanvas) {
          // draw bbox and landmarks if user wants debug visualization
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const box = r.detection.box;
          ctx.strokeStyle = "#00FF00";
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          ctx.fillStyle = "#FF0000";
          r.landmarks.positions.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
            ctx.fill();
          });

          // draw label
          const emoji = expressionToEmoji(label);
          const text = `${emoji} ${label} ${(score * 100).toFixed(0)}%`;
          ctx.font = "16px Inter, Arial";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "black";
          ctx.fillStyle = "white";
          const tx = Math.max(8, box.x);
          const ty = box.y > 18 ? box.y - 8 : box.y + box.height + 22;
          ctx.strokeText(text, tx, ty);
          ctx.fillText(text, tx, ty);
        }
      } catch (err) {
        console.warn("[Emotion] detection error:", err);
        setLastError(String(err));
        // If this is the makeTensor / runtime mismatch, stop interval to avoid console spam
        const s = String(err || "");
        if (s.includes("makeTensor") || s.includes("Lt2.makeTensor")) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setStatus("Tensor runtime error — check TFJS/face-api versions (see console).");
        }
      }
    }, DETECT_INTERVAL_MS);
  }

  function expressionToEmoji(label: string) {
    switch (label) {
      case "happy":
        return "😄";
      case "sad":
        return "😢";
      case "angry":
        return "😠";
      case "surprised":
        return "😲";
      case "fearful":
        return "😨";
      case "disgusted":
        return "🤢";
      case "neutral":
        return "😐";
      default:
        return "🙂";
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Emotion Detection (Live)</h1>
          <p className="text-gray-600 mt-2">Real-time emotion detection running in your browser (private).</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col items-center">
            <div className="mb-2 text-sm text-gray-600">{status}</div>
            {lastError && <div className="mb-2 text-sm text-red-600">Error: {lastError}</div>}

            <div className="relative bg-black rounded overflow-hidden">
              {/* Visible video feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="rounded-lg"
                style={{ width: 640, height: 480, backgroundColor: "#000" }}
              />
              {/* Hidden/optional canvas used for processing; show only if debug enabled */}
              <canvas
                ref={canvasRef}
                style={{ display: showDebugCanvas ? "block" : "none", position: "absolute", left: 0, top: 0 }}
                width={640}
                height={480}
              />
            </div>

            <div className="mt-4 text-lg font-semibold">
              {dominant ? `${expressionToEmoji(dominant.label)} ${dominant.label} (${(dominant.score * 100).toFixed(0)}%)` : "No face detected"}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setRunning(true)}
                disabled={running || !modelsLoaded}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                Start
              </button>
              <button onClick={() => setRunning(false)} disabled={!running} className="px-4 py-2 bg-gray-600 text-white rounded">
                Stop
              </button>
              <button onClick={() => setShowDebugCanvas((s) => !s)} className="px-3 py-2 bg-indigo-600 text-white rounded">
                {showDebugCanvas ? "Hide Debug" : "Show Debug"}
              </button>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Tip: if the detection shows "No face detected" but you see yourself, try toggling "Show Debug" to view overlays and check console for errors.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
