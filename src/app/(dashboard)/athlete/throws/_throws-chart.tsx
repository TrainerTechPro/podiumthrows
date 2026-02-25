"use client";

import { LineChart, LineChartDataPoint } from "@/components/charts/LineChart";

export function ThrowsChart({ data }: { data: LineChartDataPoint[] }) {
  return (
    <LineChart
      data={data}
      height={160}
      formatY={(y) => `${y.toFixed(1)}m`}
    />
  );
}
