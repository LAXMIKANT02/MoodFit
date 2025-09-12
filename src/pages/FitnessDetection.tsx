import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

/**
 * Extended FitnessDetection.tsx
 * - Adds plank, jumping_jack, situp, deadlift in addition to squat/pushup/lunge
 * - Rule-based detection using Mediapipe landmarks
 * - Rep counting (up/down) or hold detection (plank)
 */

type Exercise =
  | "squat"
  | "pushup"
  | "lunge"
  | "plank"
  | "jumping_jack"
  | "situp"
  | "deadlift";

function getAngle(a: any, b: any, c: any) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (magAB === 0 || magCB === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const SMOOTH_WINDOW = 5;

export default function FitnessDetection(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const poseRef = useRef<Pose | null>(null);

  const navigate = useNavigate();

  // UI + state
  const [monitoring, setMonitoring] = useState(false);
  const [exercise, setExercise] = useState<Exercise>("squat");
  const [feedback, setFeedback] = useState("Select exercise and Start");
  const [reps, setReps] = useState(0);
  const repStateRef = useRef<"up" | "down" | null>(null);
  const voteBufferRef = useRef<string[]>([]);
  const lastRepTimeRef = useRef<number>(0);
  const [status, setStatus] = useState("Idle");

  // plank hold tracking
  const plankHoldStartRef = useRef<number | null>(null);
  const [plankHoldSec, setPlankHoldSec] = useState<number>(0);

  // Thresholds (tweak per camera / user)
  const SQUAT_DEPTH_ANGLE = 140;
  const PUSHUP_DEPTH_ANGLE = 95;
  const LUNGE_KNEE_ANGLE = 120;
  const PLANK_TORSO_ANGLE_MAX = 30; // degrees deviation from straight line (lower is straighter)
  const JUMPING_JACK_ARM_ANGLE_MIN = 140; // arms above head approx.
  const JUMPING_JACK_LEG_SEP_FACTOR = 0.20; // fraction of frame width: ankles separation > factor => legs apart
  const SITUP_TORSO_ANGLE_UP = 50; // smaller angle => torso up
  const SITUP_TORSO_ANGLE_DOWN = 140; // larger angle => torso down
  const DEADLIFT_TORSO_FORWARD_ANGLE = 35; // torso hinge forward beyond this => down position

  useEffect(() => {
    if (!monitoring) {
      cameraRef.current?.stop();
      cameraRef.current = null;
      try {
        (poseRef.current as any)?.close?.();
      } catch {}
      poseRef.current = null;
      setStatus("Idle");
      // reset plank hold
      plankHoldStartRef.current = null;
      setPlankHoldSec(0);
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;

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
      // defensive canvas sizing
      if (videoRef.current && (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight)) {
        canvas.width = videoRef.current.videoWidth || canvas.width;
        canvas.height = videoRef.current.videoHeight || canvas.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (results.image) ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (!results.poseLandmarks || results.poseLandmarks.length < 33) {
        setFeedback("No full-body detected — move back so full body appears");
        return;
      }

      const lm = results.poseLandmarks;
      try {
        drawConnectors(ctx, lm, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
        drawLandmarks(ctx, lm, { color: "#FF0000", lineWidth: 1 });
      } catch (e) {}

      const get = (i: number) => (i >= 0 && i < lm.length ? lm[i] : null);

      // commonly used landmarks
      const leftHip = get(23), rightHip = get(24);
      const leftKnee = get(25), rightKnee = get(26);
      const leftAnkle = get(27), rightAnkle = get(28);
      const leftShoulder = get(11), rightShoulder = get(12);
      const leftElbow = get(13), rightElbow = get(14);
      const leftWrist = get(15), rightWrist = get(16);
      const nose = get(0);

      const leftKneeAngle = leftHip && leftKnee && leftAnkle ? getAngle(leftHip, leftKnee, leftAnkle) : null;
      const rightKneeAngle = rightHip && rightKnee && rightAnkle ? getAngle(rightHip, rightKnee, rightAnkle) : null;
      const kneeAngles = [leftKneeAngle, rightKneeAngle].filter(Boolean) as number[];
      const avgKneeAngle = kneeAngles.length ? kneeAngles.reduce((a, b) => a + b, 0) / kneeAngles.length : null;

      const leftElbowAngle = leftShoulder && leftElbow && leftWrist ? getAngle(leftShoulder, leftElbow, leftWrist) : null;
      const rightElbowAngle = rightShoulder && rightElbow && rightWrist ? getAngle(rightShoulder, rightElbow, rightWrist) : null;
      const elbowAngles = [leftElbowAngle, rightElbowAngle].filter(Boolean) as number[];
      const avgElbowAngle = elbowAngles.length ? elbowAngles.reduce((a, b) => a + b, 0) / elbowAngles.length : null;

      // torso angle: shoulder - hip - ankle (smaller when hinge forward)
      const leftTorsoAngle = leftShoulder && leftHip && leftAnkle ? getAngle(leftShoulder, leftHip, leftAnkle) : null;
      const rightTorsoAngle = rightShoulder && rightHip && rightAnkle ? getAngle(rightShoulder, rightHip, rightAnkle) : null;
      const torsoAngles = [leftTorsoAngle, rightTorsoAngle].filter(Boolean) as number[];
      const avgTorsoAngle = torsoAngles.length ? torsoAngles.reduce((a, b) => a + b, 0) / torsoAngles.length : null;

      // torso upright angle for plank (should be near 180 or near straight line across depending on viewpoint)
      // For a front-facing camera, use shoulder-hip-knee or shoulder-hip-ankle deviation to estimate
      const frontTorsoAngle = leftShoulder && leftHip && leftKnee ? getAngle(leftShoulder, leftHip, leftKnee) : null;

      // frame width used for jumping jack ankle separation heuristic
      const frameWidth = canvas.width || 640;

      // --------------------
      // Per-exercise detection logic
      // --------------------
      let isDown = false; // generic vote for up/down style exercises
      if (exercise === "squat") {
        if (avgKneeAngle !== null) isDown = avgKneeAngle < SQUAT_DEPTH_ANGLE;
        if (avgKneeAngle !== null) voteBufferRef.current.push(isDown ? "down" : "up");
      } else if (exercise === "pushup") {
        if (avgElbowAngle !== null) isDown = avgElbowAngle < PUSHUP_DEPTH_ANGLE;
        if (avgElbowAngle !== null) voteBufferRef.current.push(isDown ? "down" : "up");
      } else if (exercise === "lunge") {
        if (leftKneeAngle !== null && rightKneeAngle !== null) {
          const leftBent = leftKneeAngle < LUNGE_KNEE_ANGLE;
          const rightBent = rightKneeAngle < LUNGE_KNEE_ANGLE;
          isDown = (leftBent && !rightBent) || (rightBent && !leftBent);
          voteBufferRef.current.push(isDown ? "down" : "up");
        }
      } else if (exercise === "jumping_jack") {
        // detect arms up: elbow/shoulder/wrist angle greater than threshold (near straight up)
        const armsUp = (leftWrist && leftShoulder && leftElbow && leftWrist.y < leftShoulder.y) && (rightWrist && rightShoulder && rightElbow && rightWrist.y < rightShoulder.y);
        // ankles separation
        const ankleSep = leftAnkle && rightAnkle ? Math.abs((leftAnkle.x - rightAnkle.x) * frameWidth) : 0;
        const legsApart = ankleSep > frameWidth * JUMPING_JACK_LEG_SEP_FACTOR;
        isDown = armsUp && legsApart;
        voteBufferRef.current.push(isDown ? "down" : "up");
      } else if (exercise === "situp") {
        // using shoulder-hip-knee angle: smaller angle => torso up
        const shoulder = leftShoulder || rightShoulder;
        const hip = leftHip || rightHip;
        const knee = leftKnee || rightKnee;
        const torsoAngle = shoulder && hip && knee ? getAngle(shoulder, hip, knee) : null;
        if (torsoAngle !== null) {
          // down when torsoAngle > SITUP_TORSO_ANGLE_DOWN, up when < SITUP_TORSO_ANGLE_UP
          isDown = torsoAngle < SITUP_TORSO_ANGLE_UP;
          voteBufferRef.current.push(isDown ? "down" : "up");
        }
      } else if (exercise === "deadlift") {
        // detect forward hinge by torso angle: lower torso angle (closer to 90) => bent forward
        if (avgTorsoAngle !== null) {
          isDown = avgTorsoAngle < (180 - DEADLIFT_TORSO_FORWARD_ANGLE); // if torso angle from vertical is > threshold
          voteBufferRef.current.push(isDown ? "down" : "up");
        }
      } else if (exercise === "plank") {
        // Plank is a hold. consider "good" if torso approx straight (low deviation)
        if (avgTorsoAngle !== null) {
          const deviation = Math.abs(180 - avgTorsoAngle); // if 180 is straight (depends on viewpoint)
          const good = deviation < PLANK_TORSO_ANGLE_MAX;
          // manage hold timer
          if (good) {
            if (!plankHoldStartRef.current) plankHoldStartRef.current = Date.now();
            const sec = Math.floor(((Date.now() - (plankHoldStartRef.current || Date.now())) / 1000));
            setPlankHoldSec(sec);
            setFeedback(`Plank hold: ${sec}s (keep core tight)`);
          } else {
            if (plankHoldStartRef.current) {
              // hold broken
              plankHoldStartRef.current = null;
              setPlankHoldSec(0);
              setFeedback("Plank misaligned — straighten your hips");
            } else {
              setFeedback("Plank not aligned — adjust posture");
            }
          }
        }
      }

      // --------------------
      // For non-plank exercises: smoothing & state machine (up/down)
      // --------------------
      if (exercise !== "plank") {
        const buf = voteBufferRef.current;
        if (buf.length > SMOOTH_WINDOW) buf.splice(0, buf.length - SMOOTH_WINDOW);

        const downCount = buf.filter(v => v === "down").length;
        const upCount = buf.filter(v => v === "up").length;
        const majority = downCount > upCount ? "down" : "up";

        const prev = repStateRef.current;
        if (!prev) {
          repStateRef.current = majority === "down" ? "down" : "up";
        } else {
          if (prev === "up" && majority === "down") {
            repStateRef.current = "down";
          } else if (prev === "down" && majority === "up") {
            const now = Date.now();
            if (now - lastRepTimeRef.current > 600) {
              setReps(r => r + 1);
              lastRepTimeRef.current = now;
              // generate feedback for the rep
              const fb = generateFormFeedback({
                exercise,
                avgKneeAngle,
                avgElbowAngle,
                leftKneeAngle,
                rightKneeAngle,
                avgTorsoAngle,
                leftAnkle,
                rightAnkle,
                nose,
              });
              setFeedback(fb);
            }
            repStateRef.current = "up";
          }
        }
      }

      // HUD
      ctx.font = "18px Inter, Arial";
      ctx.fillStyle = "white";
      if (exercise === "plank") {
        ctx.fillText(`Plank hold: ${plankHoldSec}s`, 10, 24);
      } else {
        ctx.fillText(`Exercise: ${exercise.toUpperCase()}  Reps: ${reps}`, 10, 24);
      }
    });

    cameraRef.current = new Camera(videoRef.current!, {
      onFrame: async () => {
        if (poseRef.current && videoRef.current) await poseRef.current.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });

    cameraRef.current.start();
    setStatus("Monitoring — camera started");
    setFeedback("Position yourself and start");

    return () => {
      cameraRef.current?.stop();
      cameraRef.current = null;
      // reset plank
      plankHoldStartRef.current = null;
      setPlankHoldSec(0);
      setStatus("Stopped");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoring, exercise, reps]);

  // UI helpers
  function handleStart() {
    voteBufferRef.current = [];
    repStateRef.current = null;
    lastRepTimeRef.current = 0;
    setReps(0);
    plankHoldStartRef.current = null;
    setPlankHoldSec(0);
    setFeedback("Get ready...");
    setMonitoring(true);
  }

  function handleStop() {
    setMonitoring(false);
    setFeedback("Stopped");
  }

  function openRecorder() {
    navigate(`/session/exercise/${exercise}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Fitness Detection</h1>
          <p className="text-gray-600 mt-2">Real-time exercise detection, rep counting and form feedback</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col items-center">
            <div className="mb-4 flex gap-3">
              <select
                value={exercise}
                onChange={(e) => {
                  const val = e.target.value as Exercise;
                  setExercise(val);
                  setReps(0);
                  repStateRef.current = null;
                  voteBufferRef.current = [];
                  plankHoldStartRef.current = null;
                  setPlankHoldSec(0);
                  setFeedback("Select exercise and Start");
                }}
                className="px-3 py-2 border rounded"
              >
                <option value="squat">Squat</option>
                <option value="pushup">Push-up</option>
                <option value="lunge">Lunge</option>
                <option value="plank">Plank (hold)</option>
                <option value="jumping_jack">Jumping Jack</option>
                <option value="situp">Sit-up</option>
                <option value="deadlift">Deadlift</option>
              </select>

              <button onClick={handleStart} disabled={monitoring} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">Start</button>
              <button onClick={handleStop} disabled={!monitoring} className="px-4 py-2 bg-gray-600 text-white rounded">Stop</button>
              <button onClick={() => { setReps(0); repStateRef.current = null; voteBufferRef.current = []; setFeedback("Reset"); plankHoldStartRef.current = null; setPlankHoldSec(0); }} className="px-3 py-2 bg-yellow-500 text-white rounded">Reset</button>

              <button onClick={openRecorder} className="px-3 py-2 bg-blue-600 text-white rounded">Record Session</button>
            </div>

            <div className="bg-black rounded overflow-hidden">
              <video ref={videoRef} className="hidden" playsInline />
              <canvas ref={canvasRef} width={640} height={480} className="rounded-lg shadow-lg" />
            </div>

            <div className="mt-4 text-lg font-semibold">
              {exercise === "plank" ? (
                <span>Plank hold: <span className="text-2xl text-blue-600">{plankHoldSec}s</span></span>
              ) : (
                <span>Reps: <span className="text-2xl text-blue-600">{reps}</span></span>
              )}
            </div>

            <div className="mt-2 text-md text-gray-700 font-medium">{feedback}</div>
            <div className="mt-3 text-xs text-gray-500">Tip: position camera so your full body is visible. For plank, try side/front angle where torso alignment is visible.</div>
            <div className="mt-2 text-xs text-gray-400">Status: {status}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** generate textual feedback for new exercises */
function generateFormFeedback(params: {
  exercise: Exercise;
  avgKneeAngle?: number | null;
  avgElbowAngle?: number | null;
  leftKneeAngle?: number | null;
  rightKneeAngle?: number | null;
  avgTorsoAngle?: number | null;
  leftAnkle?: any;
  rightAnkle?: any;
  nose?: any;
}) {
  const { exercise, avgKneeAngle, avgElbowAngle, leftKneeAngle, rightKneeAngle, avgTorsoAngle, leftAnkle, rightAnkle, nose } = params;
  if (exercise === "squat") {
    if (avgKneeAngle === null) return "Move a bit so knees are visible.";
    if (avgKneeAngle > 170) return "Try deeper — bend knees more.";
    if (avgKneeAngle < 110) return "Great depth — control the ascent.";
    if (leftKneeAngle && rightKneeAngle && Math.abs(leftKneeAngle - rightKneeAngle) > 12) return "One knee collapsing — keep knees aligned with toes.";
    return "Good squat rep!";
  }
  if (exercise === "pushup") {
    if (avgElbowAngle === null) return "Move closer to camera so arms are visible.";
    if (avgElbowAngle > 150) return "Not low enough — lower chest to ~90° elbow bend.";
    if (avgElbowAngle < 70) return "Excellent depth — keep core tight.";
    return "Good push-up rep!";
  }
  if (exercise === "lunge") {
    if (leftKneeAngle == null || rightKneeAngle == null) return "Make sure both legs are visible.";
    if (leftKneeAngle > 160 && rightKneeAngle > 160) return "Step further into lunge (bend front knee).";
    return "Good lunge rep!";
  }
  if (exercise === "jumping_jack") {
    return "Nice jumping jack!";
  }
  if (exercise === "situp") {
    if (avgTorsoAngle == null) return "Keep shoulder/hip/knee visible.";
    if (avgTorsoAngle < 60) return "Good sit-up height!";
    return "Try to sit up higher each rep.";
  }
  if (exercise === "deadlift") {
    if (avgTorsoAngle == null) return "Make sure torso is visible.";
    if (avgTorsoAngle < 120) return "Hinge at hips; keep back neutral.";
    return "Good hip hinge!";
  }
  if (exercise === "plank") {
    return "Hold steady — keep hips aligned and core tight.";
  }
  return "Nice rep!";
}
