import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

function getAngle(a: any, b: any, c: any) {
  // Angle at point b given 3 points a-b-c
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  const angle = (Math.acos(dot / (magAB * magCB)) * 180) / Math.PI;
  return angle;
}

const PostureDetection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [feedback, setFeedback] = useState("Click Start to begin posture monitoring.");

  useEffect(() => {
    if (!monitoring || !videoRef.current || !canvasRef.current) return;

    const canvasCtx = canvasRef.current.getContext("2d")!;

    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasRef.current!.width,
        canvasRef.current!.height
      );

      if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 3,
        });
        drawLandmarks(canvasCtx, landmarks, {
          color: "#FF0000",
          lineWidth: 1,
        });

        // --- Posture Logic ---
        const leftEar = landmarks[7];
        const leftShoulder = landmarks[11];
        const leftHip = landmarks[23];

        const rightEar = landmarks[8];
        const rightShoulder = landmarks[12];
        const rightHip = landmarks[24];

        if (leftEar && leftShoulder && leftHip) {
          const backAngle = getAngle(leftEar, leftShoulder, leftHip);
          if (backAngle < 150) {
            setFeedback("⚠️ You're slouching! Sit up straight.");
          } else {
            setFeedback("✅ Good posture, keep it up!");
          }
        }

        // Check head tilt (ear-shoulder verticality)
        if (leftEar && leftShoulder && rightEar && rightShoulder) {
          const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
          if (shoulderDiff > 0.05) {
            setFeedback("⚠️ Your shoulders are uneven, try to balance.");
          }
        }
      }
    });

    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => {
        await pose.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });

    cameraRef.current.start();

    return () => {
      cameraRef.current?.stop();
    };
  }, [monitoring]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors"
          >
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Posture Detection</h1>
          <p className="text-gray-600 mt-2">
            Real-time posture monitoring and correction alerts
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {monitoring ? "Posture Monitoring Active" : "Click Start to Begin"}
            </h2>

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 min-h-[400px] flex flex-col items-center justify-center border-dashed">
              {monitoring ? (
                <>
                  <video ref={videoRef} className="hidden" />
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    className="rounded-lg shadow-lg"
                  />
                  <p className="mt-4 text-lg font-semibold text-gray-800">
                    {feedback}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  AI will monitor your posture when you start detection
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-center space-x-4">
              <button
                onClick={() => setMonitoring(true)}
                disabled={monitoring}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                Start Monitoring
              </button>
              <button
                onClick={() => setMonitoring(false)}
                disabled={!monitoring}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
              >
                Stop Detection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostureDetection;
