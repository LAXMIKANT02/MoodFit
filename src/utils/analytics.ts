// src/utils/analytics.ts
import { FullSession } from "./sessionStorage";

/* --------------------------
   Types
   -------------------------- */
export type AnalyticsPoint = {
  t: number;
  kneeAngle?: number | null;
  backAngle?: number | null;
  elbowAngle?: number | null;
  bodyAngle?: number | null;
  hipAngle?: number | null;
  score?: number | null;      // 0..1 normalized score for the frame
  category?: string | null;   // Excellent | Good | Fair | Poor
  correct?: boolean;          // legacy boolean (score >= framePassThreshold)
};

export type AnalyticsResult = {
  totalFrames: number;
  correctFrames: number; // frames with score >= framePassThreshold
  accuracyPct: number;   // weighted percentage (avg score * 100)
  timeline: AnalyticsPoint[];
  goodReps: number;
  badReps: number;
  repDetails: Array<any>;
  sampledForChart: { timeSec: number; value?: number | null; value2?: number | null; correct?: boolean; score?: number | null; category?: string | null }[];
  meta?: Record<string, any>;
  categoryCounts: { [k: string]: number }; // Excellent/Good/Fair/Poor
  repCategoryCounts: { [k: string]: number }; // per-rep categories
  overallWeightedScore: number; // 0..100
};

/* --------------------------
   RULES: thresholds per exercise/pose
   -------------------------- */
export const RULES: Record<string, any> = {
  squat: {
    primaryMetric: "knee",
    metrics: {
      knee: { ideal: 90, tol: 28 },
      back: { ideal: 180, tol: 40 },
    },
    minFramesForRep: 6,
    correctRatioThreshold: 0.55,
    framePassThreshold: 0.6,
    polarity: "valley",
  },
  pushup: {
    primaryMetric: "elbow",
    metrics: {
      elbow: { ideal: 90, tol: 28 },
      body: { ideal: 180, tol: 20 },
    },
    minFramesForRep: 6,
    correctRatioThreshold: 0.55,
    framePassThreshold: 0.6,
    polarity: "valley",
  },
  plank: {
    primaryMetric: "body",
    metrics: {
      body: { ideal: 180, tol: 12 },
    },
    minFramesForRep: Infinity,
    correctRatioThreshold: 0.85,
    framePassThreshold: 0.85,
    polarity: "none",
  },
  lunge: {
    primaryMetric: "front_knee",
    metrics: {
      front_knee: { ideal: 90, tol: 22 },
      torso: { ideal: 180, tol: 30 },
    },
    minFramesForRep: 6,
    correctRatioThreshold: 0.55,
    framePassThreshold: 0.6,
    polarity: "valley",
  },
  tree: {
    primaryMetric: "standing_leg",
    metrics: {
      standing_leg: { ideal: 180, tol: 15 },
      arms: { ideal: 180, tol: 25 },
    },
    minFramesForRep: Infinity,
    correctRatioThreshold: 0.9,
    framePassThreshold: 0.85,
    polarity: "none",
  },
  warrior2: {
    primaryMetric: "front_knee",
    metrics: {
      front_knee: { ideal: 90, tol: 20 },
      arms: { ideal: 180, tol: 20 },
    },
    minFramesForRep: Infinity,
    correctRatioThreshold: 0.85,
    framePassThreshold: 0.8,
    polarity: "none",
  },
  default: {
    primaryMetric: "knee",
    metrics: {
      knee: { ideal: 90, tol: 40 },
      back: { ideal: 180, tol: 40 },
    },
    minFramesForRep: 6,
    correctRatioThreshold: 0.5,
    framePassThreshold: 0.55,
    polarity: "valley",
  },
};

/* --------------------------
   Utilities
   -------------------------- */
function getAngle(a: any, b: any, c: any): number | null {
  if (!a || !b || !c) return null;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (magAB === 0 || magCB === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function smoothSeries(vals: Array<number | null>, radius = 2) {
  const n = vals.length;
  const out: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const win: number[] = [];
    for (let j = i - radius; j <= i + radius; j++) {
      if (j >= 0 && j < n && vals[j] !== null && vals[j] !== undefined) win.push(vals[j] as number);
    }
    out[i] = win.length ? win.reduce((a, b) => a + b, 0) / win.length : NaN;
  }
  return out;
}

function buildSampled(timeline: AnalyticsPoint[], step = 1) {
  const sampled: { timeSec: number; value?: number | null; value2?: number | null; correct?: boolean; score?: number | null; category?: string | null }[] = [];
  for (let i = 0; i < timeline.length; i += step) {
    const p = timeline[i];
    sampled.push({
      timeSec: Math.round(p.t / 1000),
      value: p.kneeAngle ?? p.elbowAngle ?? p.bodyAngle ?? p.backAngle ?? null,
      value2: p.backAngle ?? p.bodyAngle ?? null,
      correct: p.correct,
      score: p.score ?? null,
      category: p.category ?? null,
    });
  }
  return sampled;
}

/* --------------------------
   Metric extraction (MediaPipe pose indices)
   -------------------------- */
function computeMetricAnglesFromLandmarks(lm: any[]) {
  const get = (i: number) => (lm && lm[i] ? lm[i] : null);
  const leftHip = get(23), rightHip = get(24);
  const leftKnee = get(25), rightKnee = get(26);
  const leftAnkle = get(27), rightAnkle = get(28);
  const leftShoulder = get(11), rightShoulder = get(12);
  const leftElbow = get(13), rightElbow = get(14);
  const leftWrist = get(15), rightWrist = get(16);
  const leftEar = get(7), rightEar = get(8);

  const r: { [metric: string]: number | null } = {};

  const leftKneeAngle = leftHip && leftKnee && leftAnkle ? getAngle(leftHip, leftKnee, leftAnkle) : null;
  const rightKneeAngle = rightHip && rightKnee && rightAnkle ? getAngle(rightHip, rightKnee, rightAnkle) : null;
  r.knee = [leftKneeAngle, rightKneeAngle].filter(Boolean).length ? ((((leftKneeAngle || 0) + (rightKneeAngle || 0)) / (((leftKneeAngle ? 1 : 0) + (rightKneeAngle ? 1 : 0))))) : null;

  const leftBack = leftEar && leftShoulder && leftHip ? getAngle(leftEar, leftShoulder, leftHip) : null;
  const rightBack = rightEar && rightShoulder && rightHip ? getAngle(rightEar, rightShoulder, rightHip) : null;
  r.back = [leftBack, rightBack].filter(Boolean).length ? ((((leftBack || 0) + (rightBack || 0)) / (((leftBack ? 1 : 0) + (rightBack ? 1 : 0))))) : null;

  const leftElbowAngle = leftShoulder && leftElbow && leftWrist ? getAngle(leftShoulder, leftElbow, leftWrist) : null;
  const rightElbowAngle = rightShoulder && rightElbow && rightWrist ? getAngle(rightShoulder, rightElbow, rightWrist) : null;
  r.elbow = [leftElbowAngle, rightElbowAngle].filter(Boolean).length ? ((((leftElbowAngle || 0) + (rightElbowAngle || 0)) / (((leftElbowAngle ? 1 : 0) + (rightElbowAngle ? 1 : 0))))) : null;

  const leftBody = leftShoulder && leftHip && leftAnkle ? getAngle(leftShoulder, leftHip, leftAnkle) : null;
  const rightBody = rightShoulder && rightHip && rightAnkle ? getAngle(rightShoulder, rightHip, rightAnkle) : null;
  r.body = [leftBody, rightBody].filter(Boolean).length ? ((((leftBody || 0) + (rightBody || 0)) / (((leftBody ? 1 : 0) + (rightBody ? 1 : 0))))) : null;

  r.front_knee = null;
  if (leftKnee && rightKnee) {
    const leftY = leftKnee.y ?? 9999;
    const rightY = rightKnee.y ?? 9999;
    if (leftY < rightY) r.front_knee = leftHip && leftKnee && leftAnkle ? getAngle(leftHip, leftKnee, leftAnkle) : null;
    else r.front_knee = rightHip && rightKnee && rightAnkle ? getAngle(rightHip, rightKnee, rightAnkle) : null;
  } else {
    r.front_knee = r.knee;
  }

  r.hip = null;
  if (leftHip && leftShoulder && leftKnee) r.hip = getAngle(leftShoulder, leftHip, leftKnee);
  else if (rightHip && rightShoulder && rightKnee) r.hip = getAngle(rightShoulder, rightHip, rightKnee);

  r.arms = r.elbow;

  return r;
}

/* --------------------------
   Scoring helpers
   - per-metric errorFactor = abs(value - ideal) / tol
   - per-metric score = clamp(1 - errorFactor, 0, 1)
   - frame score = average of metric scores (ignore missing metrics)
   - categories: Excellent(>=0.85), Good(>=0.65), Fair(>=0.4), Poor(<0.4)
   -------------------------- */
function getMetricScore(value: number | null, spec: { ideal: number; tol: number } | undefined): number | null {
  if (value === null || value === undefined || !spec) return null;
  const err = Math.abs(value - spec.ideal);
  const ef = spec.tol <= 0 ? (err === 0 ? 0 : 1) : Math.min(1, err / spec.tol);
  const score = Math.max(0, 1 - ef); // 1 => perfect, 0 => completely off (>= tol)
  return score;
}

function frameCategoryFromScore(score: number | null) {
  if (score === null || isNaN(score)) return "Unknown";
  if (score >= 0.85) return "Excellent";
  if (score >= 0.65) return "Good";
  if (score >= 0.40) return "Fair";
  return "Poor";
}

/* --------------------------
   Generic analyzer by rule
   -------------------------- */
function analyzeByRule(session: FullSession, rule: any, opts?: { smoothRadius?: number; sampleStep?: number }): AnalyticsResult {
  const smoothRadius = opts?.smoothRadius ?? 2;
  const sampleStep = opts?.sampleStep ?? 1;
  const timeline: AnalyticsPoint[] = [];

  for (const f of session.frames || []) {
    const lm = f.landmarks || [];
    const metricAngles = computeMetricAnglesFromLandmarks(lm);

    const p: AnalyticsPoint = {
      t: f.t,
      kneeAngle: metricAngles.knee ?? null,
      backAngle: metricAngles.back ?? null,
      elbowAngle: metricAngles.elbow ?? null,
      bodyAngle: metricAngles.body ?? null,
      hipAngle: metricAngles.hip ?? null,
      correct: true,
      score: null,
      category: null,
    };

    // compute per-metric score and average (ignore missing)
    const metrics = rule.metrics || {};
    const metricScores: number[] = [];
    for (const mk of Object.keys(metrics)) {
      const spec = metrics[mk];
      const value = (metricAngles as any)[mk];
      const ms = getMetricScore(value, spec);
      if (ms !== null && !isNaN(ms)) metricScores.push(ms);
    }
    const frameScore = metricScores.length ? (metricScores.reduce((a, b) => a + b, 0) / metricScores.length) : NaN;
    p.score = isNaN(frameScore) ? null : Number(frameScore.toFixed(3));
    p.category = frameCategoryFromScore(p.score ?? null);

    // legacy boolean "correct" based on framePassThreshold
    const passThreshold = rule.framePassThreshold ?? 0.6;
    p.correct = (p.score !== null && p.score >= passThreshold);

    timeline.push(p);
  }

  const totalFrames = timeline.length;
  const correctFrames = timeline.filter(p => p.correct).length;
  // accuracyPct as average frame score * 100 (weighted)
  const avgScore = totalFrames ? (timeline.reduce((acc, p) => acc + (p.score || 0), 0) / totalFrames) : 0;
  const accuracyPct = Math.round(avgScore * 100);

  // rep detection using primary metric series as earlier
  const primary = rule.primaryMetric || "knee";
  const arr: Array<number | null> = timeline.map(pt => {
    if (primary === "knee") return pt.kneeAngle ?? null;
    if (primary === "back") return pt.backAngle ?? null;
    if (primary === "elbow") return pt.elbowAngle ?? null;
    if (primary === "body") return pt.bodyAngle ?? null;
    if (primary === "front_knee") return pt.kneeAngle ?? null;
    return (pt.kneeAngle ?? pt.elbowAngle ?? pt.bodyAngle ?? null);
  });

  const smoothed = smoothSeries(arr, smoothRadius);
  const valleys: number[] = [];
  const peaks: number[] = [];
  for (let i = 1; i < smoothed.length - 1; i++) {
    if (!isFinite(smoothed[i])) continue;
    if (smoothed[i] < smoothed[i - 1] && smoothed[i] < smoothed[i + 1]) valleys.push(i);
    if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1]) peaks.push(i);
  }

  const repDetails: any[] = [];
  const polarity = rule.polarity || "valley";
  const keyIndices = polarity === "peak" ? peaks : valleys;

  for (let k = 0; k < keyIndices.length - 1; k++) {
    const si = keyIndices[k];
    const ei = keyIndices[k + 1];
    if (!isFinite(si) || !isFinite(ei)) continue;
    if (ei - si < (rule.minFramesForRep || 6)) continue;
    const segment = timeline.slice(si, ei + 1);
    const smoothSeg = smoothed.slice(si, ei + 1).filter(v => isFinite(v));
    if (smoothSeg.length === 0) continue;
    const minV = Math.min(...smoothSeg);
    const maxV = Math.max(...smoothSeg);

    // average frame score for the rep (treat null as 0)
    const frameScores = segment.map(s => (s.score != null ? s.score : 0));
    const avgFrameScore = frameScores.length ? (frameScores.reduce((a, b) => a + b, 0) / frameScores.length) : 0;

    const primarySpec = rule.metrics && rule.metrics[primary];
    let meetsDepth = false;
    if (primarySpec) {
      if (polarity === "valley") meetsDepth = !isNaN(minV) && Math.abs(minV - primarySpec.ideal) <= primarySpec.tol;
      if (polarity === "peak") meetsDepth = !isNaN(maxV) && Math.abs(maxV - primarySpec.ideal) <= primarySpec.tol;
    } else {
      meetsDepth = true;
    }

    const threshold = rule.correctRatioThreshold ?? 0.6;
    const softThreshold = Math.max(0.4, threshold - 0.18);
    const closeDepth = primarySpec ? (polarity === "valley"
      ? (!isNaN(minV) && Math.abs(minV - primarySpec.ideal) <= (primarySpec.tol * 0.5))
      : (!isNaN(maxV) && Math.abs(maxV - primarySpec.ideal) <= (primarySpec.tol * 0.5)))
      : false;

    const isGood = (meetsDepth && avgFrameScore >= threshold) || (closeDepth && avgFrameScore >= softThreshold);

    // rep category mapping by avgFrameScore
    const repCategory = frameCategoryFromScore(avgFrameScore);

    repDetails.push({
      startT: segment[0].t,
      endT: segment[segment.length - 1].t,
      minV: isFinite(minV) ? minV : null,
      maxV: isFinite(maxV) ? maxV : null,
      isGood,
      avgFrameScore,
      correctRatio: avgFrameScore,
      category: repCategory,
      frames: segment.length,
    });
  }

  const goodReps = repDetails.filter((r) => r.isGood).length;
  const badReps = repDetails.length - goodReps;

  const sampled = buildSampled(timeline, sampleStep);

  // category counts for frames
  const categoryCounts: { [k: string]: number } = { Excellent: 0, Good: 0, Fair: 0, Poor: 0, Unknown: 0 };
  timeline.forEach((p) => {
    const cat = p.category || "Unknown";
    if (!categoryCounts[cat]) categoryCounts[cat] = 0;
    categoryCounts[cat]++;
  });

  // rep category counts
  const repCategoryCounts: { [k: string]: number } = {};
  repDetails.forEach((r: any) => {
    repCategoryCounts[r.category] = (repCategoryCounts[r.category] || 0) + 1;
  });

  return {
    totalFrames,
    correctFrames,
    accuracyPct,
    timeline,
    goodReps,
    badReps,
    repDetails,
    sampledForChart: sampled,
    meta: { ruleName: rule.name || null },
    categoryCounts,
    repCategoryCounts,
    overallWeightedScore: Math.round(avgScore * 100),
  };
}

/* --------------------------
   Public API
   -------------------------- */
export function computeExerciseAnalytics(session: FullSession, opts?: { smoothRadius?: number; sampleStep?: number }): AnalyticsResult {
  const ex = (session.exercise || "").toLowerCase().trim();
  const ruleKey = Object.keys(RULES).find(k => ex.includes(k)) || "default";
  const rule = { ...(RULES[ruleKey] || RULES.default) };
  rule.name = ruleKey;
  return analyzeByRule(session, rule, opts);
}
