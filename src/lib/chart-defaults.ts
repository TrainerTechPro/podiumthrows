export const PODIUM_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "var(--surface-overlay)",
      titleColor: "var(--foreground)",
      bodyColor: "var(--muted)",
      borderColor: "var(--card-border)",
      borderWidth: 1,
      padding: 10,
      cornerRadius: 12,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 10, family: "var(--font-ibm-plex-mono)" },
        color: "var(--muted)",
      },
    },
    y: {
      grid: { color: "rgba(255,255,255,0.04)" },
      ticks: {
        font: { size: 10, family: "var(--font-ibm-plex-mono)" },
        color: "var(--muted)",
      },
    },
  },
} as const;

export const PODIUM_LINE_DATASET_BASE = {
  borderColor: "#FFC800",
  backgroundColor: "rgba(255,200,0,0.06)",
  pointBackgroundColor: "#FFC800",
  pointBorderColor: "var(--card-bg)",
  pointBorderWidth: 2,
  pointRadius: 4,
  tension: 0.35,
  fill: true,
} as const;

export function goalLineDataset(goalValue: number, xStart: string, xEnd: string) {
  return {
    data: [
      { x: xStart, y: goalValue },
      { x: xEnd, y: goalValue },
    ],
    borderColor: "rgba(56,178,172,0.65)",
    borderDash: [5, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0,
    fill: false,
    label: "Goal",
  };
}
