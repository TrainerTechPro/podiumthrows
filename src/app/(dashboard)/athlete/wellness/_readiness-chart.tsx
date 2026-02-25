"use client";

import { LineChart, LineChartDataPoint } from "@/components/charts/LineChart";

export function ReadinessChart({ data }: { data: LineChartDataPoint[] }) {
  return (
    <LineChart
      data={data}
      height={140}
      yMin={1}
      yMax={10}
      formatY={(y) => y.toFixed(1)}
    />
  );
}
