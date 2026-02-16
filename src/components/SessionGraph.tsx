// src/components/SessionGraph.tsx
import React, { useMemo } from "react";
import { FullSession } from "../utils/sessionStorage";
import { computeExerciseAnalytics } from "../utils/analytics";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend, BarChart, Bar, Cell,
} from "recharts";

type Props = {
  session: FullSession;
  smoothRadius?: number;
  sampleStep?: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  Excellent: "#10b981", // green
  Good: "#3b82f6",      // blue
  Fair: "#f59e0b",      // amber
  Poor: "#ef4444",      // red
  Unknown: "#9ca3af",
};

export default function SessionGraph({ session, smoothRadius = 2, sampleStep = 1 }: Props) {
  const analytics = useMemo(() => computeExerciseAnalytics(session, { smoothRadius, sampleStep }), [session, smoothRadius, sampleStep]);

  const primary = analytics.meta?.exercise || session.exercise || "squat";
  const lineData = analytics.sampledForChart.map(d => ({
    time: d.timeSec,
    value: d.value,
    value2: d.value2,
    score: d.score,
    category: d.category,
  }));

  // --- DEBUG: inspect analytics coming from computeExerciseAnalytics
  // Open DevTools Console and look for these logs when rendering the component
  console.log("SessionGraph: analytics:", analytics);
  console.log("SessionGraph: lineData sample:", lineData.slice(0, 10));

  const radialData = [{ name: "Score", value: analytics.overallWeightedScore, fill: "#3b82f6" }];

  const categorySummary = Object.entries(analytics.categoryCounts || {}).map(([k, v]) => ({
    category: k,
    count: v,
    pct: analytics.totalFrames ? Math.round((v / analytics.totalFrames) * 100) : 0,
    color: CATEGORY_COLORS[k] || "#9ca3af",
  }));

  // Bar chart data: one bar per category (Excellent/Good/Fair/Poor/Unknown) to show distribution
  const barData = categorySummary.map(c => ({ name: c.category, value: c.count, color: c.color }));

  const repSummary = Object.entries(analytics.repCategoryCounts || {}).map(([k, v]) => ({ category: k, count: v }));

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="col-span-1 flex flex-col items-center justify-center">
          <h4 className="text-sm text-gray-600">{primary.toUpperCase()} Score</h4>
          <div style={{ width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="100%" data={radialData} startAngle={180} endAngle={-180}>
                <RadialBar minAngle={15} background clockWise={false} dataKey="value" />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-lg font-semibold">{analytics.overallWeightedScore}%</div>
          <div className="text-sm text-gray-500">Weighted score (0-100)</div>

          <div className="mt-3 w-full">
            <div className="grid grid-cols-2 gap-2">
              {categorySummary.map((c) => (
                <div key={c.category} className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{c.category}</div>
                    <div className="text-sm font-semibold">{c.count}</div>
                  </div>
                  <div className="text-sm text-gray-500">{c.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <h4 className="text-sm text-gray-600 mb-2">Primary metric & score over time</h4>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis dataKey="time" tickFormatter={(v) => `${v}s`} />
                <YAxis domain={[0, 200]} />
                <Tooltip
                  labelFormatter={(label) => `${label}s`}
                  formatter={(val: any, name: any) => {
                    // nicer tooltip for score vs value
                    if (name === "score") return [`${Math.round((val || 0) * 100)}%`, "Score"];
                    return [val, name];
                  }}
                />
                <Line type="monotone" dataKey="value" stroke={CATEGORY_COLORS.Excellent} dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" dataKey="score" stroke={CATEGORY_COLORS.Good} strokeWidth={2} yAxisId="right" isAnimationActive={false} />
                <Legend verticalAlign="top" height={36} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category distribution bar chart (shows counts for Excellent/Good/Fair/Poor/Unknown) */}
          <div className="mt-4">
            <h5 className="text-sm font-medium mb-2">Category distribution</h5>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Count">
                    {barData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color || "#8884d8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Good reps</div>
              <div className="text-xl font-semibold text-green-600">{analytics.goodReps}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Bad reps</div>
              <div className="text-xl font-semibold text-red-600">{analytics.badReps}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Duration</div>
              <div className="text-xl font-semibold">{Math.round(session.durationMs / 1000)}s</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Frames</div>
              <div className="text-xl font-semibold">{analytics.totalFrames}</div>
            </div>
          </div>
        </div>
      </div>

      {analytics.repDetails && analytics.repDetails.length > 0 && (
        <div className="mt-4">
          <h5 className="text-sm font-medium mb-2">Rep details</h5>
          <div className="grid md:grid-cols-3 gap-2">
            {analytics.repDetails.map((r: any, idx: number) => (
              <div key={idx} className="p-2 border rounded">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Rep #{idx + 1}</div>
                  <div className={`text-xs font-semibold ${
                    r.category === "Excellent" ? "text-green-600" :
                    r.category === "Good" ? "text-blue-600" :
                    r.category === "Fair" ? "text-yellow-600" :
                    "text-red-600"
                  }`}>
                    {r.category}
                  </div>
                </div>
                <div className="text-xs text-gray-500">Duration: {Math.round((r.endT - r.startT) / 1000)}s</div>
                <div className="text-xs">Min: {r.minV ? `${r.minV.toFixed(1)}°` : "n/a"}</div>
                <div className="text-xs">Avg score: {(r.avgFrameScore * 100).toFixed(0)}%</div>
                <div className="text-xs">Correct frames: {(r.correctRatio * 100 || 0).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
