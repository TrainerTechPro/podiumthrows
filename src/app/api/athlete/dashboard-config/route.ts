import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  WIDGET_IDS,
  PRESETS,
  type WidgetId,
  type PresetId,
} from "@/app/(dashboard)/athlete/dashboard/_widget-registry";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { preset, widgets, order } = body;

  // If preset is a known name, use its config directly
  if (preset && preset in PRESETS && !widgets) {
    const presetConfig = PRESETS[preset as PresetId];
    await prisma.athleteProfile.update({
      where: { userId: session.userId },
      data: { dashboardConfig: presetConfig },
    });
    return NextResponse.json(presetConfig);
  }

  // Custom config
  if (!Array.isArray(widgets) || !Array.isArray(order)) {
    return NextResponse.json(
      { error: "widgets and order must be arrays" },
      { status: 400 },
    );
  }

  // Validate widget IDs
  const validWidgets = widgets.filter((w): w is WidgetId =>
    WIDGET_IDS.includes(w as WidgetId),
  );
  const validOrder = order.filter((w): w is WidgetId =>
    validWidgets.includes(w as WidgetId),
  );

  // Ensure readiness always present and first
  if (!validWidgets.includes("readiness")) validWidgets.unshift("readiness");
  if (!validOrder.includes("readiness")) validOrder.unshift("readiness");
  else if (validOrder[0] !== "readiness") {
    validOrder.splice(validOrder.indexOf("readiness"), 1);
    validOrder.unshift("readiness");
  }

  // Check if matches a preset
  let resolvedPreset: string = "custom";
  for (const [name, p] of Object.entries(PRESETS)) {
    if (
      JSON.stringify(p.widgets) === JSON.stringify(validWidgets) &&
      JSON.stringify(p.order) === JSON.stringify(validOrder)
    ) {
      resolvedPreset = name;
      break;
    }
  }

  const config = {
    preset: resolvedPreset,
    widgets: validWidgets,
    order: validOrder,
  };
  await prisma.athleteProfile.update({
    where: { userId: session.userId },
    data: { dashboardConfig: config },
  });

  return NextResponse.json(config);
}
