import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

/**
 * FitnessDetection with Mode Toggle (Exercise <-> Yoga)
 *
 * - Top toggle to switch between Exercise and Yoga mode.
 * - Different select options per mode.
 * - Exercise: rep counting, form feedback (existing).
 * - Yoga: hold-style (timer) feedback for poses (e.g., Tree, Warrior).
 * - Record Session opens the SessionRecorder with the correct mode param.
 */

type ExerciseKey =
  | "squat"
  | "pushup"
  | "lunge"
  | "plank"
  | "jumping_jack"
  | "situp"
  | "deadlift";

type YogaKey =
  | "tree"
  | "warrior2"
  | "downward_dog"
  | "child_pose"
  | "cobra"
  | "bridge"
  | "seated_forward_fold";

type Mode = "exercise" | "yoga";
type Activity = ExerciseKey | YogaKey;

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

  // Top-level mode state (exercise OR yoga)
  const [mode, setMode] = useState<Mode>("exercise");

  // activity holds either an exercise or a yoga pose key
  const [activity, setActivity] = useState<Activity>("squat");

  // shared UI state
  const [monitoring, setMonitoring] = useState(false);
  const [feedback, setFeedback] = useState("Select activity and Start");
  const [reps, setReps] = useState(0);
  const repStateRef = useRef<"up" | "down" | null>(null);
  const voteBufferRef = useRef<string[]>([]);
  const lastRepTimeRef = useRef<number>(0);
  const [status, setStatus] = useState("Idle");

  // Yoga/plank hold timer
  const holdStartRef = useRef<number | null>(null);
  const [holdSec, setHoldSec] = useState<number>(0);

  // thresholds (tweakable)
  const SQUAT_DEPTH_ANGLE = 140;
  const PUSHUP_DEPTH_ANGLE = 95;
  const LUNGE_KNEE_ANGLE = 120;
  const PLANK_TORSO_ANGLE_MAX = 30;

  // lists for dropdown
  const exercises: ExerciseKey[] = ["squat", "pushup", "lunge", "plank", "jumping_jack", "situp", "deadlift"];
  const yogaPoses: YogaKey[] = ["tree", "warrior2", "downward_dog", "child_pose", "cobra", "bridge", "seated_forward_fold"];

  useEffect(() => {
    // default activity when mode changes
    if (mode === "exercise") {
      // keep current if it's an exercise, otherwise set default
      if (!exercises.includes(activity as ExerciseKey)) setActivity("squat");
    } else {
      if (!yogaPoses.includes(activity as YogaKey)) setActivity("tree");
    }

    // reset counters & holds when switching mode
    setReps(0);
    repStateRef.current = null;
    voteBufferRef.current = [];
    holdStartRef.current = null;
    setHoldSec(0);
    setFeedback("Select activity and Start");
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!monitoring) {
      cameraRef.current?.stop();
      cameraRef.current = null;
      try {
        (poseRef.current as any)?.close?.();
      } catch {}
      poseRef.current = null;
      setStatus("Idle");
      holdStartRef.current = null;
      setHoldSec(0);
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

      // helper
      const get = (i: number) => (i >= 0 && i < lm.length ? lm[i] : null);
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

      const leftTorsoAngle = leftShoulder && leftHip && leftAnkle ? getAngle(leftShoulder, leftHip, leftAnkle) : null;
      const rightTorsoAngle = rightShoulder && rightHip && rightAnkle ? getAngle(rightShoulder, rightHip, rightAnkle) : null;
      const torsoAngles = [leftTorsoAngle, rightTorsoAngle].filter(Boolean) as number[];
      const avgTorsoAngle = torsoAngles.length ? torsoAngles.reduce((a, b) => a + b, 0) / torsoAngles.length : null;

      // --- Behaviour for Exercise mode (rep counting as before) ---
      if (mode === "exercise") {
        let isDown = false;
        if (activity === "squat") {
          if (avgKneeAngle !== null) isDown = avgKneeAngle < SQUAT_DEPTH_ANGLE;
        } else if (activity === "pushup") {
          if (avgElbowAngle !== null) isDown = avgElbowAngle < PUSHUP_DEPTH_ANGLE;
        } else if (activity === "lunge") {
          if (leftKneeAngle !== null && rightKneeAngle !== null) {
            const leftBent = leftKneeAngle < LUNGE_KNEE_ANGLE;
            const rightBent = rightKneeAngle < LUNGE_KNEE_ANGLE;
            isDown = (leftBent && !rightBent) || (rightBent && !leftBent);
          }
        } else if (activity === "plank") {
          // treat like hold — but still push into exercise flow if user chooses
          const deviation = avgTorsoAngle ? Math.abs(180 - avgTorsoAngle) : 999;
          const good = deviation < PLANK_TORSO_ANGLE_MAX;
          if (good) {
            if (!holdStartRef.current) holdStartRef.current = Date.now();
            setHoldSec(Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000)));
            setFeedback(`Plank hold: ${Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000))}s`);
          } else {
            if (holdStartRef.current) {
              holdStartRef.current = null;
              setHoldSec(0);
              setFeedback("Plank misaligned — straighten hips");
            } else {
              setFeedback("Plank not aligned — adjust posture");
            }
          }
          // skip rep counting for plank
          return;
        } else if (activity === "jumping_jack") {
          // detect jumpjacks by arms up + legs apart (simple heuristics)
          const armsUp = (leftWrist && leftShoulder && leftWrist.y < leftShoulder.y) && (rightWrist && rightShoulder && rightWrist.y < rightShoulder.y);
          const ankleSep = leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : 0;
          const legsApart = ankleSep > 0.22; // heuristic fraction
          isDown = armsUp && legsApart;
        } else if (activity === "situp") {
          // torso up detection: shoulder-hip-knee angle small when up
          const shoulder = leftShoulder || rightShoulder;
          const hip = leftHip || rightHip;
          const knee = leftKnee || rightKnee;
          if (shoulder && hip && knee) {
            const torsoAngle = getAngle(shoulder, hip, knee);
            isDown = torsoAngle < 60; // up = smaller angle
          }
        } else if (activity === "deadlift") {
          if (avgTorsoAngle !== null) {
            isDown = avgTorsoAngle < 120; // hinge forward
          }
        }

        // voting + smoothing
        if (typeof isDown === "boolean") {
          voteBufferRef.current.push(isDown ? "down" : "up");
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
                // feedback for the rep
                setFeedback(simpleFeedback(activity, { avgKneeAngle, avgElbowAngle, avgTorsoAngle, leftKneeAngle, rightKneeAngle }));
              }
              repStateRef.current = "up";
            }
          }
        }
      }

      // --- Behaviour for Yoga mode (hold poses) ---
      else {
        // for yoga we treat selected pose as a hold — simple heuristics:
        // tree: single-leg balance -> check ankle/hip vertical difference
        // warrior2: require arms extended horizontally (approx)
        // downward_dog: detect hips high and legs straight
        // default generic check: torso reasonably upright or pose-specific suggestions
        if (activity === "tree") {
          // if one ankle y is significantly higher than the other OR one ankle near hip x -> balance
          const leftAnkle = get(27), rightAnkle = get(28);
          if (leftAnkle && rightAnkle && (leftAnkle.y && rightAnkle.y)) {
            const diffY = Math.abs(leftAnkle.y - rightAnkle.y);
            if (diffY > 0.04) {
              // likely balancing
              if (!holdStartRef.current) holdStartRef.current = Date.now();
              setHoldSec(Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000)));
              setFeedback(`Tree Pose hold: ${Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000))}s`);
            } else {
              if (holdStartRef.current) {
                holdStartRef.current = null;
                setHoldSec(0);
                setFeedback("Balance lost — find your center");
              } else setFeedback("Try to shift weight for Tree Pose");
            }
          }
        } else if (activity === "warrior2") {
          // check arms roughly horizontal: shoulder-elbow-wrist y similar
          const leftElbow = get(13), rightElbow = get(14);
          if (leftElbow && rightElbow && leftShoulder && rightShoulder) {
            const leftDiff = Math.abs(leftElbow.y - leftShoulder.y);
            const rightDiff = Math.abs(rightElbow.y - rightShoulder.y);
            if (leftDiff < 0.12 && rightDiff < 0.12) {
              if (!holdStartRef.current) holdStartRef.current = Date.now();
              setHoldSec(Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000)));
              setFeedback(`Warrior II hold: ${Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000))}s`);
            } else {
              if (holdStartRef.current) {
                holdStartRef.current = null;
                setHoldSec(0);
                setFeedback("Arms not level — try to open your chest");
              } else setFeedback("Open arms and square torso for Warrior II");
            }
          }
        } else {
          // generic yoga hold: use torso alignment as placeholder
          const deviation = avgTorsoAngle ? Math.abs(180 - avgTorsoAngle) : 999;
          const good = deviation < 40;
          if (good) {
            if (!holdStartRef.current) holdStartRef.current = Date.now();
            setHoldSec(Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000)));
            setFeedback(`${activity.replace("_", " ")} hold: ${Math.floor(((Date.now() - (holdStartRef.current || Date.now())) / 1000))}s`);
          } else {
            if (holdStartRef.current) {
              holdStartRef.current = null;
              setHoldSec(0);
              setFeedback("Adjust alignment for the pose");
            } else setFeedback("Adjust your posture for the pose");
          }
        }
      }

      // HUD overlays
      ctx.font = "18px Inter, Arial";
      ctx.fillStyle = "white";
      if (mode === "yoga") {
        ctx.fillText(`Pose: ${String(activity).toUpperCase()}  Hold: ${holdSec}s`, 10, 24);
      } else {
        ctx.fillText(`Activity: ${String(activity).toUpperCase()}  Reps: ${reps}`, 10, 24);
      }
    });

    // start camera helper
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
      holdStartRef.current = null;
      setHoldSec(0);
      setStatus("Stopped");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoring, activity, mode, reps]);

  // UI handlers
  function handleStart() {
    voteBufferRef.current = [];
    repStateRef.current = null;
    lastRepTimeRef.current = 0;
    setReps(0);
    holdStartRef.current = null;
    setHoldSec(0);
    setFeedback("Get ready...");
    setMonitoring(true);
  }

  function handleStop() {
    setMonitoring(false);
    setFeedback("Stopped");
  }

  function openRecorder() {
    // navigate to session recorder with selected mode & activity
    navigate(`/session/${mode}/${activity}`);
  }

  // simple feedback generator (smaller than before)
  function simpleFeedback(act: Activity, info: any) {
    if (act === "squat") {
      if (!info.avgKneeAngle) return "Move back so knees visible";
      if (info.avgKneeAngle > 170) return "Try deeper — bend knees more";
      return "Good squat rep!";
    }
    if (act === "pushup") {
      if (!info.avgElbowAngle) return "Move closer for arms";
      if (info.avgElbowAngle > 150) return "Not low enough — lower chest";
      return "Nice push-up rep!";
    }
    return "Good rep!";
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fitness</h1>
            <p className="text-gray-600 mt-1">Choose Exercise or Yoga — track reps or hold poses</p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setMode("exercise")}
              className={`px-4 py-2 rounded ${mode === "exercise" ? "bg-blue-600 text-white" : "bg-white border"}`}
            >
              Exercise
            </button>
            <button
              onClick={() => setMode("yoga")}
              className={`px-4 py-2 rounded ${mode === "yoga" ? "bg-blue-600 text-white" : "bg-white border"}`}
            >
              Yoga
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col items-center">
            <div className="mb-4 w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <label className="text-sm font-medium">Activity</label>
                <select
                  value={activity}
                  onChange={(e) => {
                    const val = e.target.value as Activity;
                    setActivity(val);
                    // reset run-time state
                    setReps(0);
                    repStateRef.current = null;
                    voteBufferRef.current = [];
                    holdStartRef.current = null;
                    setHoldSec(0);
                    setFeedback("Select activity and Start");
                  }}
                  className="px-3 py-2 border rounded ml-2"
                >
                  {mode === "exercise"
                    ? exercises.map(ex => <option key={ex} value={ex}>{ex.replace("_", " ").toUpperCase()}</option>)
                    : yogaPoses.map(y => <option key={y} value={y}>{y.replace("_", " ").toUpperCase()}</option>)
                  }
                </select>
              </div>

              <div className="flex gap-2">
                <button onClick={handleStart} disabled={monitoring} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">Start</button>
                <button onClick={handleStop} disabled={!monitoring} className="px-4 py-2 bg-gray-600 text-white rounded">Stop</button>
                <button onClick={() => { setReps(0); repStateRef.current = null; voteBufferRef.current = []; holdStartRef.current = null; setHoldSec(0); setFeedback("Reset"); }} className="px-3 py-2 bg-yellow-500 text-white rounded">Reset</button>
                <button onClick={openRecorder} className="px-3 py-2 bg-blue-600 text-white rounded">Record Session</button>
              </div>
            </div>

            <div className="bg-black rounded overflow-hidden">
              <video ref={videoRef} className="hidden" playsInline />
              <canvas ref={canvasRef} width={640} height={480} className="rounded-lg shadow-lg" />
            </div>

            <div className="mt-4 text-lg font-semibold">
              {mode === "yoga" ? (
                <span>Hold: <span className="text-2xl text-blue-600">{holdSec}s</span></span>
              ) : (
                <span>Reps: <span className="text-2xl text-blue-600">{reps}</span></span>
              )}
            </div>

            <div className="mt-2 text-md text-gray-700 font-medium">{feedback}</div>
            <div className="mt-3 text-xs text-gray-500">Tip: position camera so your full body is visible. For yoga, a side or front angle helps depending on the pose.</div>
            <div className="mt-2 text-xs text-gray-400">Status: {status}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
