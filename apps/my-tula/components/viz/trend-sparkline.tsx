"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, YAxis, ResponsiveContainer } from "recharts";

type Point = { i: number; v: number };

export function TrendSparkline({
  values,
  height = 28,
  ariaLabel,
}: {
  values: number[];
  height?: number;
  ariaLabel?: string;
}) {
  // Recharts' ResponsiveContainer needs a real DOM to measure. Gate the
  // render until after mount so SSR doesn't emit width=-1 warnings, and
  // so the initial paint reserves the same vertical space.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!values || values.length === 0) return null;

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="w-full"
        style={{ height }}
      />
    );
  }

  const data: Point[] = values.map((v, i) => ({ i, v }));

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `Trend over last ${values.length} readings`}
      className="w-full"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
