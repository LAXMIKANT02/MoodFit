import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

/**
 * Advanced FitnessDetection.tsx
 * - Rule-based detection for Squat, Push-up, Lunge
 * - Rep counting with smoothing and debounce
 * - Per-rep form feedback
 * - Button to open Session Recorder for current exercise
 */

type Exercise = "squat" | "pushup" | "lunge";

function getAngle(a: any, b: any, c: any) {
  // compute angle at point b between a-b-c in degrees
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (magAB === 0 || magCB === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const SMOOTH_WINDOW = 5; // number of recent votes used for majority

export default function FitnessDetection(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const poseRef = useRef<Pose | null>(null);

  const navigate = useNavigate();

  const [monitoring, setMonitoring] = useState(false);
  const [exercise, setExercise] = useState<Exercise>("squat");
  const [feedback, setFeedback] = useState("Select exercise and Start");
  const [reps, setReps] = useState(0);
  const repStateRef = useRef<"up" | "down" | null>(null);
  const voteBufferRef = useRef<string[]>([]);
  const lastRepTimeRef = useRef<number>(0);
  const [modelsReady, setModelsReady] = useState(true); // Mediapipe loads internally; keep true
  const [status, setStatus] = useState("Idle");

  // thresholds (tweak as needed per camera and user)
  const SQUAT_DEPTH_ANGLE = 140; // knee angle threshold for squat (smaller = deeper)
  const PUSHUP_DEPTH_ANGLE = 90; // elbow angle threshold for pushup (smaller = deeper)
  const LUNGE_KNEE_ANGLE = 120; // knee angle threshold for lunge (front knee bent)

  useEffect(() => {
    // Start / stop behavior handled below by monitoring state
    if (!monitoring) {
      // cleanup
      cameraRef.current?.stop();
      cameraRef.current = null;
      try {
        (poseRef.current as any)?.close?.();
      } catch {}
      poseRef.current = null;
      setStatus("Idle");
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;

    // create pose instance if not created
    if (!poseRef.current) {
      poseRef.current = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
    }
    const pose = poseRef.current;

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: any) => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (results.image) ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (!results.poseLandmarks || results.poseLandmarks.length < 33) {
        setFeedback("No full-body detected — move back so full body appears");
        return;
      }

      const lm = results.poseLandmarks;

      // draw skeleton (nice visual feedback)
      try {
        drawConnectors(ctx, lm, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
        drawLandmarks(ctx, lm, { color: "#FF0000", lineWidth: 1 });
      } catch (e) {}

      const get = (i: number) => (i >= 0 && i < lm.length ? lm[i] : null);

      // Landmark indices (Mediapipe Pose)
      const leftHip = get(23), rightHip = get(24);
      const leftKnee = get(25), rightKnee = get(26);
      const leftAnkle = get(27), rightAnkle = get(28);
      const leftShoulder = get(11), rightShoulder = get(12);
      const leftElbow = get(13), rightElbow = get(14);
      const leftWrist = get(15), rightWrist = get(16);

      const leftKneeAngle = leftHip && leftKnee && leftAnkle ? getAngle(leftHip, leftKnee, leftAnkle) : null;
      const rightKneeAngle = rightHip && rightKnee && rightAnkle ? getAngle(rightHip, rightKnee, rightAnkle) : null;
      const kneeAngles = [leftKneeAngle, rightKneeAngle].filter(Boolean) as number[];
      const avgKneeAngle = kneeAngles.length ? kneeAngles.reduce((a, b) => a + b, 0) / kneeAngles.length : null;

      const leftElbowAngle = leftShoulder && leftElbow && leftWrist ? getAngle(leftShoulder, leftElbow, leftWrist) : null;
      const rightElbowAngle = rightShoulder && rightElbow && rightWrist ? getAngle(rightShoulder, rightElbow, rightWrist) : null;
      const elbowAngles = [leftElbowAngle, rightElbowAngle].filter(Boolean) as number[];
      const avgElbowAngle = elbowAngles.length ? elbowAngles.reduce((a, b) => a + b, 0) / elbowAngles.length : null;

      // vote whether user is "down" or "up" for current exercise
      if (exercise === "squat") {
        if (avgKneeAngle !== null) {
          const isDown = avgKneeAngle < SQUAT_DEPTH_ANGLE;
          voteBufferRef.current.push(isDown ? "down" : "up");
        }
      } else if (exercise === "pushup") {
        if (avgElbowAngle !== null) {
          const isDown = avgElbowAngle < PUSHUP_DEPTH_ANGLE;
          voteBufferRef.current.push(isDown ? "down" : "up");
        }
      } else if (exercise === "lunge") {
        if (leftKneeAngle !== null && rightKneeAngle !== null) {
          const leftBent = leftKneeAngle < LUNGE_KNEE_ANGLE;
          const rightBent = rightKneeAngle < LUNGE_KNEE_ANGLE;
          // lunge down if one knee is significantly bent and the other is not
          const isDown = (leftBent && !rightBent) || (rightBent && !leftBent);
          voteBufferRef.current.push(isDown ? "down" : "up");
        }
      }

      // smoothing
      const buf = voteBufferRef.current;
      if (buf.length > SMOOTH_WINDOW) buf.splice(0, buf.length - SMOOTH_WINDOW);
      const downCount = buf.filter(v => v === "down").length;
      const upCount = buf.filter(v => v === "up").length;
      const majority = downCount > upCount ? "down" : "up";

      // state machine for rep counting
      const prev = repStateRef.current;
      if (!prev) {
        repStateRef.current = majority === "down" ? "down" : "up";
      } else {
        if (prev === "up" && majority === "down") {
          repStateRef.current = "down";
        } else if (prev === "down" && majority === "up") {
          const now = Date.now();
          if (now - lastRepTimeRef.current > 600) { // debounce
            setReps(r => r + 1);
            lastRepTimeRef.current = now;

            // generate simple feedback for completed rep
            const fb = generateFormFeedback({
              exercise,
              avgKneeAngle,
              avgElbowAngle,
              leftKneeAngle,
              rightKneeAngle,
            });
            setFeedback(fb);
          }
          repStateRef.current = "up";
        }
      }

      // small HUD text
      ctx.font = "18px Inter, Arial";
      ctx.fillStyle = "white";
      ctx.fillText(`Exercise: ${exercise.toUpperCase()}  Reps: ${reps}`, 10, 24);
    });

    // start Mediapipe Camera helper
    cameraRef.current = new Camera(videoRef.current!, {
      onFrame: async () => {
        if (poseRef.current && videoRef.current) await poseRef.current.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });

    cameraRef.current.start();
    setStatus("Monitoring — camera started");
    setFeedback("Good luck — do a few practice reps");

    return () => {
      cameraRef.current?.stop();
      cameraRef.current = null;
      setStatus("Stopped");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoring, exercise, reps]);

  // UI handlers
  function handleStart() {
    // reset counters/votes when starting
    voteBufferRef.current = [];
    repStateRef.current = null;
    lastRepTimeRef.current = 0;
    setReps(0);
    setFeedback("Position yourself so your full body is visible, then start moving");
    setMonitoring(true);
  }

  function handleStop() {
    setMonitoring(false);
    setFeedback("Stopped");
  }

  function openRecorder() {
    // open session recorder page for this exercise (mode=exercise)
    navigate(`/session/exercise/${exercise}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/dashboard" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-900">Fitness Detection</h1>
          <p className="text-gray-600 mt-2">Real-time rep counting and form feedback (client-side)</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col items-center">
            <div className="mb-4 flex gap-3">
              <select
                value={exercise}
                onChange={(e) => {
                  const val = e.target.value as Exercise;
                  setExercise(val);
                  // reset state when switching exercises
                  setReps(0);
                  repStateRef.current = null;
                  voteBufferRef.current = [];
                  setFeedback("Select exercise and Start");
                }}
                className="px-3 py-2 border rounded"
              >
                <option value="squat">Squat</option>
                <option value="pushup">Push-up</option>
                <option value="lunge">Lunge</option>
              </select>

              <button onClick={handleStart} disabled={monitoring || !modelsReady} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">Start</button>
              <button onClick={handleStop} disabled={!monitoring} className="px-4 py-2 bg-gray-600 text-white rounded">Stop</button>
              <button onClick={() => { setReps(0); repStateRef.current = null; voteBufferRef.current = []; setFeedback("Reset"); }} className="px-3 py-2 bg-yellow-500 text-white rounded">Reset</button>

              <button onClick={openRecorder} className="px-3 py-2 bg-blue-600 text-white rounded">Record Session</button>
            </div>

            <div className="bg-black rounded overflow-hidden">
              {/* visible UI shows canvas (skeleton overlay) */}
              <video ref={videoRef} className="hidden" playsInline />
              <canvas ref={canvasRef} width={640} height={480} className="rounded-lg shadow-lg" />
            </div>

            <div className="mt-4 text-lg font-semibold">
              Reps: <span className="text-2xl text-blue-600">{reps}</span>
            </div>
            <div className="mt-2 text-md text-gray-700 font-medium">{feedback}</div>
            <div className="mt-3 text-xs text-gray-500">Tip: position camera so your full body (hips & knees) is visible. Good lighting helps detection.</div>
            <div className="mt-2 text-xs text-gray-400">Status: {status}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** helper form feedback generator */
function generateFormFeedback(params: {
  exercise: Exercise;
  avgKneeAngle: number | null;
  avgElbowAngle: number | null;
  leftKneeAngle: number | null;
  rightKneeAngle: number | null;
}) {
  const { exercise, avgKneeAngle, avgElbowAngle, leftKneeAngle, rightKneeAngle } = params;
  if (exercise === "squat") {
    if (avgKneeAngle === null) return "Move back so knees are visible.";
    if (avgKneeAngle > 170) return "Try deeper — bend knees more.";
    if (avgKneeAngle < 110) return "Great depth — control the ascent.";
    if (leftKneeAngle && rightKneeAngle && Math.abs(leftKneeAngle - rightKneeAngle) > 12) {
      return "One knee collapsing — keep knees aligned with toes.";
    }
    return "Good squat rep!";
  }
  if (exercise === "pushup") {
    if (avgElbowAngle === null) return "Move closer so arms are visible.";
    if (avgElbowAngle > 150) return "Not low enough — lower chest to ~90° elbow bend.";
    if (avgElbowAngle < 70) return "Excellent depth — keep core tight.";
    return "Good push-up rep!";
  }
  if (exercise === "lunge") {
    if (leftKneeAngle === null || rightKneeAngle === null) return "Make sure both legs are visible.";
    if (leftKneeAngle > 160 && rightKneeAngle > 160) return "Step further into lunge (bend front knee).";
    if (leftKneeAngle < 120 && rightKneeAngle < 120) return "Both knees bent — try focusing on single-leg depth.";
    return "Good lunge rep!";
  }
  return "Nice rep!";
}
